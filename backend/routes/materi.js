const express = require('express');
const multer = require('multer');
const path = require('path');
const Materi = require('../models/Materi');
const Mapel = require('../models/Mapel');
const { auth, requireRole } = require('../middleware/auth');
const { ok, ApiError } = require('../utils/response');
const {
  EKSTENSI_DIDUKUNG,
  chunkText,
  addDocuments,
  extractTextFromFile,
  hapusDocumentByMateriId,
} = require('../../ai-service/embeddings');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// Buku yang di-upload biasanya berisi BANYAK bab/topik sekaligus, bukan satu topik tunggal - kalau
// selalu disimpan sebagai SATU materi besar, tampilan "Kelola Materi" jadi kurang berguna (satu
// baris mewakili seluruh buku), padahal hirarkinya seharusnya mata pelajaran -> materi PER TOPIK
// (lihat komentar ingestMateri di bawah soal hirarki Mapel > Materi). Jadi file yang di-upload
// (bukan konten yang diketik manual) otomatis dipecah per BAB kalau terdeteksi lebih dari satu -
// tiap bab jadi materi tersendiri, semuanya tetap di bawah mapel/jenjang/kelas yang sama.
const POLA_BAB = /^(bab\s+\S+|kegiatan\s+belajar\s+\S+|pembelajaran\s+\d+\b)/i;
const PANJANG_MINIMAL_BAB = 100;

function pisahPerBab(teks) {
  const baris = teks.replace(/\r\n/g, '\n').split('\n');
  const bagian = [];
  let babSaatIni = null;
  let isi = [];

  function simpanBagian() {
    const konten = isi.join('\n').trim();
    if (konten.length > 0) bagian.push({ bab: babSaatIni, konten });
  }

  for (const b of baris) {
    const t = b.trim();
    if (t.length > 0 && t.length < 100 && POLA_BAB.test(t)) {
      simpanBagian();
      babSaatIni = t;
      isi = [];
    } else {
      isi.push(b);
    }
  }
  simpanBagian();

  // Bagian sebelum bab pertama (mis. sampul/daftar isi) dan bab yang isinya terlalu tipis (mis.
  // heading palsu yang kebetulan cocok pola) dibuang - tidak layak jadi materi tersendiri.
  return bagian.filter((s) => s.bab && s.konten.length >= PANJANG_MINIMAL_BAB);
}

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

// `materi` di sini harus sudah di-populate('mapel') supaya metadata vector store (dipakai untuk
// citation "sumber" ke pengguna) menyimpan NAMA mapel yang bisa dibaca, bukan ObjectId mentah.
async function ingestMateri(materi) {
  if (!materi.konten) return;

  const metadata = {
    materi_id: String(materi._id),
    mapel: materi.mapel?.nama || String(materi.mapel),
    jenjang: materi.jenjang,
    kelas: materi.kelas,
    bab: materi.bab,
  };

  try {
    const chunks = chunkText(materi.konten, 500);
    const docs = chunks.map((teks, i) => ({
      id: `${metadata.materi_id}-${i}`,
      text: teks,
      metadata: { ...metadata, chunk_index: i },
    }));
    await addDocuments(docs);
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

    const materi = await Materi.find(filter).sort({ createdAt: -1 }).populate('mapel', 'nama icon warna');
    return ok(res, materi, 'Daftar materi berhasil diambil');
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const materi = await Materi.findById(req.params.id).populate('mapel', 'nama icon warna');
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

    const mapelDoc = await Mapel.findById(mapel).catch(() => null);
    if (!mapelDoc) {
      throw new ApiError('Mata pelajaran tidak ditemukan. Pilih dari daftar mapel yang tersedia.', 400);
    }

    if (req.file && !konten) {
      konten = await ambilKontenDariFile(req.file);
    }

    if (!konten || !konten.trim()) {
      throw new ApiError('Konten materi wajib diisi (tulis manual atau upload file PDF/TXT/DOCX/JPG/PNG)', 400);
    }

    // Pemecahan otomatis HANYA untuk file yang di-upload (bukan konten yang diketik/tempel manual -
    // itu sudah pasti dimaksudkan jadi satu materi tunggal oleh guru/admin yang mengetiknya).
    const babTerpisah = req.file ? pisahPerBab(konten) : [];

    if (babTerpisah.length > 1) {
      const fileUrl = `/uploads/${req.file.filename}`;
      const materiList = [];
      for (const bagian of babTerpisah) {
        let materiBab = await Materi.create({
          judul: `${judul} — ${bagian.bab}`,
          mapel: mapelDoc._id,
          jenjang,
          kelas,
          bab: bagian.bab,
          konten: bagian.konten,
          file_url: fileUrl,
          dibuat_oleh: req.user.id,
        });
        materiBab = await materiBab.populate('mapel', 'nama icon warna');
        await ingestMateri(materiBab);
        materiList.push(materiBab);
      }

      return ok(
        res,
        materiList,
        `File ini berisi ${materiList.length} bab - otomatis dipecah jadi ${materiList.length} materi terpisah`,
        201
      );
    }

    let materi = await Materi.create({
      judul,
      mapel: mapelDoc._id,
      jenjang,
      kelas,
      bab: bab || babTerpisah[0]?.bab,
      konten,
      file_url: req.file ? `/uploads/${req.file.filename}` : undefined,
      dibuat_oleh: req.user.id,
    });
    materi = await materi.populate('mapel', 'nama icon warna');

    await ingestMateri(materi);

    return ok(res, materi, 'Materi berhasil dibuat', 201);
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

    const materi = await Materi.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate(
      'mapel',
      'nama icon warna'
    );
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
