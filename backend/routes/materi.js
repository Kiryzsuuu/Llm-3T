const express = require('express');
const multer = require('multer');
const path = require('path');
const Materi = require('../models/Materi');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');
const { chunkText, addDocument, extractTextFromFile, hapusDocumentByMateriId } = require('../../ai-service/embeddings');

const router = express.Router();

const EKSTENSI_DIDUKUNG = ['.pdf', '.txt', '.docx'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

async function ambilKontenDariFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EKSTENSI_DIDUKUNG.includes(ext)) {
    throw new ApiError(`Format file tidak didukung: ${ext}. Gunakan PDF, TXT, atau DOCX.`, 400);
  }

  try {
    return await extractTextFromFile(file.path);
  } catch (err) {
    throw new ApiError(`Gagal membaca isi file: ${err.message}`, 400);
  }
}

async function ingestMateri(materi) {
  if (!materi.konten) return;

  const metadata = {
    materi_id: String(materi._id),
    mapel: materi.mapel,
    jenjang: materi.jenjang,
    kelas: materi.kelas,
    bab: materi.bab,
  };

  try {
    const chunks = chunkText(materi.konten, 500);
    for (let i = 0; i < chunks.length; i++) {
      await addDocument({ id: `${metadata.materi_id}-${i}`, text: chunks[i], metadata: { ...metadata, chunk_index: i } });
    }
  } catch (err) {
    // Ingest RAG bersifat best-effort: materi tetap tersimpan di DB meski Ollama sedang offline.
    console.error('Gagal mengindeks materi ke vector store:', err.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { mapel, jenjang, kelas, bab } = req.query;
    const filter = {};
    if (mapel) filter.mapel = mapel;
    if (jenjang) filter.jenjang = jenjang;
    if (kelas) filter.kelas = kelas;
    if (bab) filter.bab = bab;

    const materi = await Materi.find(filter).sort({ createdAt: -1 });
    return ok(res, materi, 'Daftar materi berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const materi = await Materi.findById(req.params.id);
    if (!materi) throw new ApiError('Materi tidak ditemukan', 404);
    return ok(res, materi, 'Detail materi berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.post('/', auth, requireRole('guru', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { judul, mapel, jenjang, kelas, bab } = req.body;
    let { konten } = req.body;

    if (!judul || !mapel || !jenjang || !kelas) {
      throw new ApiError('judul, mapel, jenjang, dan kelas wajib diisi', 400);
    }

    if (req.file && !konten) {
      konten = await ambilKontenDariFile(req.file);
    }

    if (!konten || !konten.trim()) {
      throw new ApiError('Konten materi wajib diisi (tulis manual atau upload file PDF/TXT/DOCX)', 400);
    }

    const materi = await Materi.create({
      judul,
      mapel,
      jenjang,
      kelas,
      bab,
      konten,
      file_url: req.file ? `/uploads/${req.file.filename}` : undefined,
      dibuat_oleh: req.user.id,
    });

    await ingestMateri(materi);

    return ok(res, materi, 'Materi berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', auth, requireRole('guru', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const update = { ...req.body };

    if (req.file) {
      update.konten = update.konten && update.konten.trim() ? update.konten : await ambilKontenDariFile(req.file);
      update.file_url = `/uploads/${req.file.filename}`;
    }

    const materi = await Materi.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!materi) throw new ApiError('Materi tidak ditemukan', 404);

    if (update.konten) {
      await ingestMateri(materi);
    }

    return ok(res, materi, 'Materi berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', auth, requireRole('guru', 'admin'), async (req, res, next) => {
  try {
    const materi = await Materi.findByIdAndDelete(req.params.id);
    if (!materi) throw new ApiError('Materi tidak ditemukan', 404);

    try {
      hapusDocumentByMateriId(materi._id);
    } catch (err) {
      console.error('Gagal membersihkan vector store untuk materi terhapus:', err.message);
    }

    return ok(res, null, 'Materi berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
