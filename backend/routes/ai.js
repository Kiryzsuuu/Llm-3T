const path = require('path');
const fs = require('fs');
const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const {
  PESAN_TIDAK_TAHU,
  AMBANG_RELEVAN,
  cekSmallTalk,
  retrieveContext,
  chatPertanyaanBaru,
  chatEvaluasiJawaban,
  generateSoal,
} = require('../../ai-service/rag');
const { getEduNusaStatus } = require('../../ai-service/ollama');
const { getCollectionStats } = require('../../ai-service/embeddings');
const { jalankan: generateDataset } = require('../../edunusa-model/training-data/prepare-dataset');
const { ok, ApiError } = require('../utils/response');
const { toCsv } = require('../utils/csv');
const AiLog = require('../models/AiLog');
const AiSesi = require('../models/AiSesi');
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

// Alur Socratic (lihat EDUNUSA_CATATAN_PERBAIKAN.md bagian 4.1, 4.2, 5, 6):
// tanya -> EduNusa beri konteks + tanya balik (tanpa bocor jawaban) -> siswa coba jawab
// -> EduNusa evaluasi jawaban siswa. Tahap disimpan eksplisit di MongoDB (AiSesi),
// TIDAK mengandalkan LLM menebak sendiri sedang di tahap mana.
router.post('/tanya', auth, async (req, res, next) => {
  try {
    const { pertanyaan, materi_id, jenjang, sesi_id } = req.body;
    if (!pertanyaan) {
      throw new ApiError('Pertanyaan wajib diisi', 400);
    }

    const mulai = Date.now();
    let hasil;

    // Tahap 2: ada sesi aktif menunggu jawaban siswa -> pesan ini adalah percobaan jawaban siswa,
    // BUKAN pertanyaan baru. Jangan lakukan retrieval/small-talk lagi, langsung evaluasi.
    const sesiAktif = sesi_id
      ? await AiSesi.findOne({ _id: sesi_id, murid_id: req.user.id, tahap: 'menunggu_jawaban_siswa' })
      : null;

    if (sesiAktif) {
      const jawaban = await chatEvaluasiJawaban({
        pertanyaanAsli: sesiAktif.pertanyaan_asli,
        konteks: sesiAktif.konteks,
        jawabanSiswa: pertanyaan,
        jenjang: sesiAktif.jenjang,
      });

      sesiAktif.tahap = 'selesai';
      await sesiAktif.save();

      hasil = {
        jawaban,
        sumber: [],
        confidence: sesiAktif.confidence,
        tahap: 'selesai',
        sesi_id: sesiAktif._id,
      };
    } else {
      // Tahap 1: pertanyaan baru. Cek small-talk dulu, baru retrieval RAG.
      const jawabanSmallTalk = cekSmallTalk(pertanyaan);

      if (jawabanSmallTalk) {
        hasil = { jawaban: jawabanSmallTalk, sumber: [], smallTalk: true, tahap: null, sesi_id: null };
      } else {
        const { dokumen, metadatas, confidence, konteks } = await retrieveContext(pertanyaan, { materi_id });

        if (dokumen.length === 0 || confidence < AMBANG_RELEVAN) {
          // Uji batasan (DoD #3): materi tak ada -> jujur bilang belum tersedia, jangan mengarang.
          hasil = { jawaban: PESAN_TIDAK_TAHU, sumber: [], confidence, tahap: null, sesi_id: null };
        } else {
          const jawaban = await chatPertanyaanBaru({ pertanyaan, konteks, jenjang });

          const sesiBaru = await AiSesi.create({
            murid_id: req.user.id,
            materi_id: materi_id || undefined,
            pertanyaan_asli: pertanyaan,
            konteks,
            jenjang,
            confidence,
            tahap: 'menunggu_jawaban_siswa',
          });

          hasil = {
            jawaban,
            sumber: dokumen.map((text, i) => ({ text, metadata: metadatas[i] || {} })),
            confidence,
            tahap: 'menunggu_jawaban_siswa',
            sesi_id: sesiBaru._id,
          };
        }
      }
    }

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
