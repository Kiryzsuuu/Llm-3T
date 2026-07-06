const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');

const router = express.Router();

// Semua endpoint di sini khusus admin.
router.use(auth, requireRole('admin'));

router.get('/', async (req, res, next) => {
  try {
    const { role, sekolah, kelas, cari } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (sekolah) filter.sekolah = sekolah;
    if (kelas) filter.kelas = kelas;
    if (cari) {
      filter.$or = [
        { nama: { $regex: cari, $options: 'i' } },
        { email: { $regex: cari, $options: 'i' } },
      ];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });
    return ok(res, users, 'Daftar pengguna berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError('Pengguna tidak ditemukan', 404);
    return ok(res, user, 'Detail pengguna berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { nama, email, password, role, sekolah, kelas } = req.body;
    if (!nama || !email || !password) {
      throw new ApiError('Nama, email, dan password wajib diisi', 400);
    }
    if (!['murid', 'guru', 'admin'].includes(role)) {
      throw new ApiError('Role harus salah satu dari: murid, guru, admin', 400);
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      throw new ApiError('Email sudah terdaftar', 409);
    }

    const hashed = await bcrypt.hash(password, 10);
    const dibuat = await User.create({ nama, email, password: hashed, role, sekolah, kelas });

    // User.create() mengembalikan dokumen penuh (mengabaikan select:false pada field password),
    // jadi ambil ulang lewat findById agar password tidak ikut terkirim ke response.
    const user = await User.findById(dibuat._id);

    return ok(res, user, 'Pengguna berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nama, email, role, sekolah, kelas, password } = req.body;

    if (role && !['murid', 'guru', 'admin'].includes(role)) {
      throw new ApiError('Role harus salah satu dari: murid, guru, admin', 400);
    }

    const update = { nama, email, role, sekolah, kelas };
    if (password) {
      update.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) throw new ApiError('Pengguna tidak ditemukan', 404);

    return ok(res, user, 'Pengguna berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      throw new ApiError('Tidak bisa menghapus akun sendiri', 400);
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError('Pengguna tidak ditemukan', 404);

    return ok(res, null, 'Pengguna berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
