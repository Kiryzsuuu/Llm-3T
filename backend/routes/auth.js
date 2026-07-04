const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { ok, fail, ApiError } = require('../utils/response');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function toPublicUser(user) {
  return {
    id: user._id,
    nama: user.nama,
    email: user.email,
    role: user.role,
    sekolah: user.sekolah,
    kelas: user.kelas,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { nama, email, password, role, sekolah, kelas } = req.body;
    if (!nama || !email || !password) {
      throw new ApiError('Nama, email, dan password wajib diisi', 400);
    }

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      throw new ApiError('Email sudah terdaftar', 409);
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      nama,
      email,
      password: hashed,
      role: ['murid', 'guru', 'admin'].includes(role) ? role : 'murid',
      sekolah,
      kelas,
    });

    const token = signToken(user);
    return ok(res, { token, user: toPublicUser(user) }, 'Registrasi berhasil', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new ApiError('Email dan password wajib diisi', 400);
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user) {
      throw new ApiError('Email atau password salah', 401);
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new ApiError('Email atau password salah', 401);
    }

    const token = signToken(user);
    return ok(res, { token, user: toPublicUser(user) }, 'Login berhasil');
  } catch (err) {
    next(err);
  }
});

router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError('User tidak ditemukan', 404);
    return ok(res, toPublicUser(user), 'Data user berhasil diambil');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
