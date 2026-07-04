const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const { tanyaAI, generateSoal } = require('../../ai-service/rag');
const { checkOllamaStatus } = require('../../ai-service/ollama');
const { getCollectionStats } = require('../../ai-service/embeddings');
const { ok, ApiError } = require('../utils/response');

const router = express.Router();

router.post('/tanya', auth, async (req, res, next) => {
  try {
    const { pertanyaan, materi_id, jenjang } = req.body;
    if (!pertanyaan) {
      throw new ApiError('Pertanyaan wajib diisi', 400);
    }

    const hasil = await tanyaAI(pertanyaan, { materi_id, jenjang });
    return ok(res, hasil, 'Jawaban AI Tutor berhasil didapatkan');
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
    const status = await checkOllamaStatus();
    return ok(res, status, 'Status Ollama berhasil diambil');
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

module.exports = router;
