const express = require('express');
const multer = require('multer');
const path = require('path');
const BankMateri = require('../models/BankMateri');
const Mapel = require('../models/Mapel');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');
const { EKSTENSI_DIDUKUNG, extractTextFromFile } = require('../../ai-service/embeddings');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

async function ambilKontenDariFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EKSTENSI_DIDUKUNG.includes(ext)) {
    throw new ApiError(`Format file tidak didukung: ${ext}. Gunakan PDF, TXT, DOCX, atau foto/scan JPG/PNG.`, 400);
  }

  try {
    return await extractTextFromFile(file.path);
  } catch (err) {
    throw new ApiError(`Gagal membaca isi file: ${err.message}`, 400);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { mapel, jenjang, cari } = req.query;
    const filter = {};
    if (mapel) filter.mapel = mapel;
    if (jenjang) filter.jenjang = jenjang;
    if (cari) filter.judul = { $regex: cari, $options: 'i' };

    const bankMateri = await BankMateri.find(filter).sort({ createdAt: -1 }).populate('mapel', 'nama icon warna');
    return ok(res, bankMateri, 'Daftar bank materi berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const item = await BankMateri.findById(req.params.id).populate('mapel', 'nama icon warna');
    if (!item) throw new ApiError('Item bank materi tidak ditemukan', 404);
    return ok(res, item, 'Detail bank materi berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, requireRole('guru', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { judul, mapel, jenjang, bab } = req.body;
    let { konten } = req.body;

    if (!judul || !mapel || !jenjang) {
      throw new ApiError('judul, mapel, dan jenjang wajib diisi', 400);
    }

    const mapelDoc = await Mapel.findById(mapel).catch(() => null);
    if (!mapelDoc) {
      throw new ApiError('Mata pelajaran tidak ditemukan. Pilih dari daftar mapel yang tersedia.', 400);
    }

    if (req.file && !konten) {
      konten = await ambilKontenDariFile(req.file);
    }

    if (!konten || !konten.trim()) {
      throw new ApiError('Konten wajib diisi (tulis manual atau upload file PDF/TXT/DOCX/JPG/PNG)', 400);
    }

    let item = await BankMateri.create({
      judul,
      mapel: mapelDoc._id,
      jenjang,
      bab,
      konten,
      file_url: req.file ? `/uploads/${req.file.filename}` : undefined,
      dibuat_oleh: req.user.id,
    });
    item = await item.populate('mapel', 'nama icon warna');

    return ok(res, item, 'Bank materi berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, requireRole('guru', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const update = { ...req.body };

    if (update.mapel) {
      const mapelDoc = await Mapel.findById(update.mapel).catch(() => null);
      if (!mapelDoc) {
        throw new ApiError('Mata pelajaran tidak ditemukan. Pilih dari daftar mapel yang tersedia.', 400);
      }
      update.mapel = mapelDoc._id;
    }

    if (req.file) {
      update.konten = update.konten && update.konten.trim() ? update.konten : await ambilKontenDariFile(req.file);
      update.file_url = `/uploads/${req.file.filename}`;
    }

    const item = await BankMateri.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate(
      'mapel',
      'nama icon warna'
    );
    if (!item) throw new ApiError('Item bank materi tidak ditemukan', 404);

    return ok(res, item, 'Bank materi berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const item = await BankMateri.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError('Item bank materi tidak ditemukan', 404);
    return ok(res, null, 'Bank materi berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
