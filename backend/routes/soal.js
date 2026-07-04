const express = require('express');
const Soal = require('../models/Soal');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { materi_id, tingkat_kesulitan } = req.query;
    const filter = {};
    if (materi_id) filter.materi_id = materi_id;
    if (tingkat_kesulitan) filter.tingkat_kesulitan = tingkat_kesulitan;

    const soal = await Soal.find(filter);
    return ok(res, soal, 'Daftar soal berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const soal = await Soal.findById(req.params.id);
    if (!soal) throw new ApiError('Soal tidak ditemukan', 404);
    return ok(res, soal, 'Detail soal berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const soal = await Soal.create(req.body);
    return ok(res, soal, 'Soal berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.soal) ? req.body.soal : req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError('Data soal harus berupa array dan tidak boleh kosong', 400);
    }

    const soal = await Soal.insertMany(items, { ordered: true });
    return ok(res, soal, `${soal.length} soal berhasil dibuat`, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/jawab', auth, async (req, res, next) => {
  try {
    const { jawaban } = req.body;
    const soal = await Soal.findById(req.params.id);
    if (!soal) throw new ApiError('Soal tidak ditemukan', 404);

    const benar = soal.jawaban_benar === jawaban;
    return ok(res, { benar, jawaban_benar: soal.jawaban_benar, penjelasan: soal.penjelasan }, 'Jawaban diperiksa');
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const soal = await Soal.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!soal) throw new ApiError('Soal tidak ditemukan', 404);
    return ok(res, soal, 'Soal berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const soal = await Soal.findByIdAndDelete(req.params.id);
    if (!soal) throw new ApiError('Soal tidak ditemukan', 404);
    return ok(res, null, 'Soal berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
