const path = require('path');
const fs = require('fs');
const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const { tanyaAI, generateSoal, PESAN_TIDAK_TAHU } = require('../../ai-service/rag');
const { getEduNusaStatus } = require('../../ai-service/ollama');
const { getCollectionStats } = require('../../ai-service/embeddings');
const { jalankan: generateDataset } = require('../../edunusa-model/training-data/prepare-dataset');
const { ok, ApiError } = require('../utils/response');
const { toCsv } = require('../utils/csv');
const AiLog = require('../models/AiLog');
const Materi = require('../models/Materi');

const router = express.Router();

async function catatAiLog({ muridId, pertanyaan, jawaban, materiId, responseTime }) {
  try {
    let mapel;
    if (materiId) {
      const materi = await Materi.findById(materiId).select('mapel');
      mapel = materi?.mapel;
    }

    await AiLog.create({
      murid_id: muridId,
      pertanyaan,
      jawaban,
      mapel,
      response_time: responseTime,
      timestamp: new Date(),
    });
  } catch (err) {
    // Logging bersifat best-effort: kegagalan mencatat log tidak boleh menggagalkan jawaban ke murid.
    console.error('Gagal mencatat ai_logs:', err.message);
  }
}

router.post('/tanya', auth, async (req, res, next) => {
  try {
    const { pertanyaan, materi_id, jenjang } = req.body;
    if (!pertanyaan) {
      throw new ApiError('Pertanyaan wajib diisi', 400);
    }

    const mulai = Date.now();
    const hasil = await tanyaAI(pertanyaan, { materi_id, jenjang });
    const responseTime = Date.now() - mulai;

    catatAiLog({
      muridId: req.user.id,
      pertanyaan,
      jawaban: hasil.jawaban,
      materiId: materi_id,
      responseTime,
    });

    return ok(res, hasil, 'Jawaban EduNusa berhasil didapatkan');
  } catch (err) {
    next(err);
  }
});

router.post('/generate-soal', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const { topik, materi_id, jumlah, tingkat_kesulitan } = req.body;
    if (!topik) {
      throw new ApiError('Topik wajib diisi', 400);
    }

    const soal = await generateSoal({
      topik,
      materiId: materi_id,
      jumlah: jumlah || 5,
      tingkat_kesulitan: tingkat_kesulitan || 'sedang',
    });

    return ok(res, soal, 'Soal berhasil digenerate');
  } catch (err) {
    next(err);
  }
});

router.get('/status', auth, async (req, res, next) => {
  try {
    const status = await getEduNusaStatus();
    return ok(res, status, 'Status EduNusa berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/stats', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const stats = getCollectionStats();
    return ok(res, stats, 'Statistik vector store berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/logs/stats', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const sekarang = new Date();
    const awalHariIni = new Date(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate());
    const awalMingguIni = new Date(awalHariIni);
    awalMingguIni.setDate(awalMingguIni.getDate() - 6);

    const [totalHariIni, totalMingguIni, agregatWaktu, tidakTerjawab, perHari, terbaru] = await Promise.all([
      AiLog.countDocuments({ timestamp: { $gte: awalHariIni } }),
      AiLog.countDocuments({ timestamp: { $gte: awalMingguIni } }),
      AiLog.aggregate([{ $group: { _id: null, rata2: { $avg: '$response_time' }, total: { $sum: 1 } } }]),
      AiLog.find({ jawaban: PESAN_TIDAK_TAHU })
        .sort({ timestamp: -1 })
        .limit(50)
        .select('pertanyaan mapel murid_id timestamp'),
      AiLog.aggregate([
        { $match: { timestamp: { $gte: awalMingguIni } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            total: { $sum: 1 },
          },
        },
      ]),
      AiLog.find().sort({ timestamp: -1 }).limit(20).select('pertanyaan jawaban mapel response_time timestamp'),
    ]);

    const perHariMap = new Map(perHari.map((d) => [d._id, d.total]));
    const pertanyaanPerHari = [];
    for (let i = 6; i >= 0; i--) {
      const tanggal = new Date(awalHariIni);
      tanggal.setDate(tanggal.getDate() - i);
      const key = tanggal.toISOString().slice(0, 10);
      pertanyaanPerHari.push({ tanggal: key, total: perHariMap.get(key) || 0 });
    }

    return ok(
      res,
      {
        totalPertanyaanHariIni: totalHariIni,
        totalPertanyaanMingguIni: totalMingguIni,
        totalPertanyaanSemua: agregatWaktu[0]?.total || 0,
        rataRataResponseTime: agregatWaktu[0] ? Math.round(agregatWaktu[0].rata2) : 0,
        pertanyaanBelumTersedia: tidakTerjawab,
        pertanyaanPerHari,
        pertanyaanTerbaru: terbaru,
      },
      'Statistik penggunaan EduNusa berhasil diambil'
    );
  } catch (err) {
    next(err);
  }
});

router.get('/logs/export', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const logs = await AiLog.find().sort({ timestamp: -1 }).lean();

    const csv = toCsv(logs, [
      { label: 'pertanyaan', value: (r) => r.pertanyaan },
      { label: 'jawaban', value: (r) => r.jawaban },
      { label: 'murid_id', value: (r) => r.murid_id || '' },
      { label: 'mapel', value: (r) => r.mapel || '' },
      { label: 'response_time_ms', value: (r) => r.response_time },
      { label: 'timestamp', value: (r) => new Date(r.timestamp).toISOString() },
    ]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="edunusa-logs-${Date.now()}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
});

router.post('/dataset/generate', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const stats = await generateDataset();
    return ok(res, stats, 'Dataset fine-tuning berhasil digenerate');
  } catch (err) {
    next(err);
  }
});

router.get('/dataset/download', auth, requireRole('admin'), async (req, res, next) => {
  try {
    const filePath = path.join(__dirname, '../../edunusa-model/training-data/dataset-final.jsonl');
    if (!fs.existsSync(filePath)) {
      throw new ApiError('Dataset belum pernah digenerate. Klik "Generate Dataset" terlebih dahulu.', 404);
    }
    return res.download(filePath, 'dataset-final.jsonl');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
