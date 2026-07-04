const express = require('express');
const Progress = require('../models/Progress');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');

const router = express.Router();

async function upsertProgress(muridId, item) {
  const { materi_id, soal_dikerjakan, soal_benar, status, synced } = item;
  if (!materi_id) {
    throw new ApiError('materi_id wajib diisi', 400);
  }

  return Progress.findOneAndUpdate(
    { murid_id: muridId, materi_id },
    {
      $set: {
        soal_dikerjakan,
        soal_benar,
        status,
        last_accessed: new Date(),
        synced: synced !== undefined ? synced : true,
      },
    },
    { new: true, upsert: true, runValidators: true }
  );
}

router.get('/murid/:id', auth, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'murid' && req.user.id !== id) {
      throw new ApiError('Akses ditolak', 403);
    }

    const progress = await Progress.find({ murid_id: id }).populate('materi_id');
    return ok(res, progress, 'Progress murid berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, async (req, res, next) => {
  try {
    const muridId = req.user.role === 'murid' ? req.user.id : req.body.murid_id;
    if (!muridId) {
      throw new ApiError('murid_id wajib diisi', 400);
    }

    const updated = await upsertProgress(muridId, req.body);
    return ok(res, updated, 'Progress berhasil disimpan', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', auth, async (req, res, next) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError('items harus berupa array dan tidak boleh kosong', 400);
    }

    const results = [];
    for (const item of items) {
      const muridId = req.user.role === 'murid' ? req.user.id : item.murid_id;
      if (!muridId) {
        throw new ApiError('murid_id wajib diisi untuk setiap item', 400);
      }
      results.push(await upsertProgress(muridId, item));
    }

    return ok(res, results, `${results.length} progress berhasil disinkronkan`, 201);
  } catch (err) {
    next(err);
  }
});

router.get('/guru/:sekolah', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const { sekolah } = req.params;

    const murid = await User.find({ role: 'murid', sekolah }).select('_id nama email kelas');
    const muridIds = murid.map((m) => m._id);

    const summary = await Progress.aggregate([
      { $match: { murid_id: { $in: muridIds } } },
      {
        $group: {
          _id: '$murid_id',
          total_materi: { $sum: 1 },
          total_soal_dikerjakan: { $sum: '$soal_dikerjakan' },
          total_soal_benar: { $sum: '$soal_benar' },
          selesai: { $sum: { $cond: [{ $eq: ['$status', 'selesai'] }, 1, 0] } },
          last_accessed: { $max: '$last_accessed' },
        },
      },
    ]);

    const summaryMap = new Map(summary.map((s) => [String(s._id), s]));

    const data = murid.map((m) => {
      const s = summaryMap.get(String(m._id));
      return {
        murid_id: m._id,
        nama: m.nama,
        email: m.email,
        kelas: m.kelas,
        total_materi: s ? s.total_materi : 0,
        total_soal_dikerjakan: s ? s.total_soal_dikerjakan : 0,
        total_soal_benar: s ? s.total_soal_benar : 0,
        materi_selesai: s ? s.selesai : 0,
        last_accessed: s ? s.last_accessed : null,
      };
    });

    return ok(res, data, 'Ringkasan progress sekolah berhasil diambil');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
