const express = require('express');
const Mapel = require('../models/Mapel');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const mapel = await Mapel.find().sort({ nama: 1 });
    return ok(res, mapel, 'Daftar mata pelajaran berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const { nama, jenjang, icon, warna } = req.body;
    if (!nama) throw new ApiError('Nama mata pelajaran wajib diisi', 400);

    const existing = await Mapel.findOne({ nama: new RegExp(`^${nama}$`, 'i') });
    if (existing) throw new ApiError('Mata pelajaran ini sudah ada', 409);

    const mapel = await Mapel.create({ nama, jenjang, icon, warna });
    return ok(res, mapel, 'Mata pelajaran berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const mapel = await Mapel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!mapel) throw new ApiError('Mata pelajaran tidak ditemukan', 404);
    return ok(res, mapel, 'Mata pelajaran berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const mapel = await Mapel.findByIdAndDelete(req.params.id);
    if (!mapel) throw new ApiError('Mata pelajaran tidak ditemukan', 404);
    return ok(res, null, 'Mata pelajaran berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
