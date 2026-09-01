const express = require('express');
const { auth } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');
const Percakapan = require('../models/Percakapan');

const router = express.Router();

// Daftar percakapan untuk sidebar riwayat - CUMA metadata (judul, mapel, waktu), TANPA isi pesan
// (bisa banyak dan berat) supaya daftar cepat dimuat. Isi lengkap baru diambil saat satu item diklik
// (lihat GET /:id).
router.get('/', auth, async (req, res, next) => {
  try {
    const daftar = await Percakapan.find({ murid_id: req.user.id })
      .select('judul mapel_terpilih materi_id createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(100);
    return ok(res, daftar, 'Daftar percakapan berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const percakapan = await Percakapan.findOne({ _id: req.params.id, murid_id: req.user.id });
    if (!percakapan) throw new ApiError('Percakapan tidak ditemukan', 404);
    return ok(res, percakapan, 'Percakapan berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const percakapan = await Percakapan.findOneAndDelete({ _id: req.params.id, murid_id: req.user.id });
    if (!percakapan) throw new ApiError('Percakapan tidak ditemukan', 404);
    return ok(res, null, 'Percakapan berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
