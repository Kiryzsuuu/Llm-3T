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
// PENTING: token setelah "bab"/"kegiatan belajar" WAJIB angka atau angka romawi, tidak boleh kata
// bebas apapun (\S+) - kalimat biasa yang KEBETULAN diawali kata "bab" di tengah paragraf yang
// terpotong PDF (mis. "bab tersebut dengan mata pelajaran lain...", "bab ini akan membahas...")
// terbukti dari pengujian nyata ikut salah kedeteksi sebagai heading bab kalau tidak dibatasi begini.
const POLA_BAB = /^(bab\s+(?:\d+|[ivxlcdm]+)\b|kegiatan\s+belajar\s+(?:\d+|[ivxlcdm]+)\b|pembelajaran\s+\d+\b)/i;
const PANJANG_MINIMAL_BAB = 100;

// Baris daftar isi (mis. "Bab 1 Diriku ..................................................... 31")
// SECARA KEBETULAN cocok pola heading bab di atas (diawali "Bab <angka>"), tapi itu cuma entri
// daftar isi dengan leader titik dan nomor halaman - bukan heading sungguhan. Sama seperti
// POLA_LEADER_TITIK_DAFTAR_ISI di ai-service/embeddings.js, tapi dipakai di sini untuk MENOLAK
// baris itu jadi pemicu bab baru sama sekali (bukan cuma dibuang saat chunking untuk RAG).
const POLA_LEADER_TITIK_DAFTAR_ISI = /\.{4,}/;

// PDF asli mengulang judul bab sebagai running header di SETIAP halaman (mis. "Bab 6 | Mengembara
// di Jagat Raya 175" di satu halaman, "Bab 6 | Mengembara di Jagat Raya 177" di halaman berikutnya
// - beda cuma nomor halaman di ekornya). Tanpa normalisasi ini, tiap pengulangan header dianggap
// bab BARU, sehingga satu bab yang harusnya jadi SATU materi malah pecah jadi puluhan materi (satu
// per halaman) - terbukti dari upload nyata (IPAS kelas VI jadi 180+ "materi" alih-alih ~6 bab).
// Kuncinya diambil dari token nomor/kode bab saja ("bab 6"), buang judul deskriptif & nomor halaman
// yang berubah-ubah tiap pengulangan.
function normalisasiKunciBab(teks) {
  const m = teks.match(/^(bab\s+(?:\d+|[ivxlcdm]+)\b|kegiatan\s+belajar\s+(?:\d+|[ivxlcdm]+)\b|pembelajaran\s+\d+)/i);
  return (m ? m[1] : teks).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Buku Guru berisi section "Kunci Jawaban" (jawaban langsung tiap soal) yang TIDAK boleh ikut
// ter-index ke RAG - kalau murid tanya sesuatu yang kebetulan me-retrieve chunk ini, jawabannya
// akan langsung terlihat lewat sitasi "sumber", merusak alur Socratic. Beda dari filter di
// prepare-dataset.js (yang cuma cek baris PENDEK), di sini dicari di mana pun posisinya dalam
// keseluruhan teks - terbukti dari pengujian nyata, tabel rubrik penilaian sering membuat frasa
// "Kunci Jawaban" menyatu di TENGAH baris panjang (bukan baris pendek berdiri sendiri) akibat cara
// pdf-parse mengekstrak tabel, sehingga gerbang "baris pendek" saja melewatkan banyak kasus nyata.
const POLA_KUNCI_JAWABAN = /kunci\s+jawaban/i;

function potongSebelumKunciJawaban(konten) {
  const match = POLA_KUNCI_JAWABAN.exec(konten);
  if (!match) return konten;
  return konten.slice(0, match.index).trim();
}

// Baris heading asli kadang diikuti nomor halaman di ekornya pada baris yang SAMA (mis. "Bab II |
// Gerak Tari 227") - beda dari heading pendek yang angkanya memang bagian dari nomor bab itu
// sendiri (mis. "Bab 4", TIDAK boleh dipotong jadi "Bab"). Angka di ekor cuma dibuang kalau ada
// teks huruf yang berarti di ANTARA penanda bab dan angka ekor itu (berarti dua angka total = satu
// nomor bab + satu nomor halaman terpisah), bukan kalau cuma ada satu angka saja.
function bersihkanNomorHalamanEkor(teks) {
  const t = String(teks || '').trim();
  const cocokAwal = t.match(/^(bab\s+(?:\d+|[ivxlcdm]+)\b|kegiatan\s+belajar\s+(?:\d+|[ivxlcdm]+)\b|pembelajaran\s+\d+)/i);
  if (!cocokAwal) return t;
  const sisa = t.slice(cocokAwal[0].length);
  if (/[A-Za-z].*\d{1,4}$/.test(sisa)) {
    return t.replace(/\s+\d{1,4}\s*$/, '').trim();
  }
  return t;
}

function pisahPerBab(teks) {
  const baris = teks.replace(/\r\n/g, '\n').split('\n');
  const bagian = [];
  let babSaatIni = null;
  let kunciSaatIni = null;
  let isi = [];

  function simpanBagian() {
    const konten = potongSebelumKunciJawaban(isi.join('\n').trim());
    if (konten.length > 0) bagian.push({ bab: babSaatIni, konten });
  }

  for (const b of baris) {
    const t = b.trim();
    const cocokHeading = t.length > 0 && t.length < 100 && POLA_BAB.test(t) && !POLA_LEADER_TITIK_DAFTAR_ISI.test(t);
    const kunci = cocokHeading ? normalisasiKunciBab(t) : null;

    if (kunci && kunci !== kunciSaatIni) {
      simpanBagian();
      babSaatIni = bersihkanNomorHalamanEkor(t);
      kunciSaatIni = kunci;
      isi = [];
    } else if (kunci) {
      // Pengulangan running header bab yang sama persis - lewati barisnya, jangan dianggap bab
      // baru maupun ikut ditambahkan ke isi (supaya isi tidak dipenuhi teks header berulang).
      continue;
    } else {
      isi.push(b);
    }
  }
  simpanBagian();

  // Bagian sebelum bab pertama (mis. sampul/daftar isi) dan bab yang isinya terlalu tipis (mis.
  // heading palsu yang kebetulan cocok pola) dibuang - tidak layak jadi materi tersendiri.
  return bagian.filter((s) => s.bab && s.konten.length >= PANJANG_MINIMAL_BAB);
}

// Dipakai jalur "Upload Buku" di frontend, yang sengaja TIDAK meminta guru/admin mengetik judul -
// mereka mengupload buku utuh, bukan mengarang judul satu topik (lihat juga pisahPerBab yang akan
// menimpa judul ini per bab kalau lebih dari satu bab terdeteksi).
function turunkanJudulDariNamaFile(namaFile) {
  const base = path.basename(namaFile, path.extname(namaFile));
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
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
    const { judul: judulMentah, mapel, jenjang, kelas, bab, mode } = req.body;
    let { konten } = req.body;

    if (!mapel || !jenjang || !kelas) {
      throw new ApiError('mapel, jenjang, dan kelas wajib diisi', 400);
    }
    // Jalur "Upload Buku" di frontend sengaja tidak meminta judul (lihat turunkanJudulDariNamaFile) -
    // judul cuma wajib diketik manual kalau tidak ada file untuk diturunkan namanya.
    if (!judulMentah && !req.file) {
      throw new ApiError('judul wajib diisi', 400);
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

    const judul = judulMentah && judulMentah.trim() ? judulMentah.trim() : turunkanJudulDariNamaFile(req.file.originalname);

    // Pemecahan otomatis HANYA untuk jalur "Upload Buku" (req.file ADA dan mode BUKAN 'manual') -
    // jalur "Tulis Materi Manual" mengirim mode='manual' secara eksplisit supaya, walau kebetulan
    // isinya menyebut kata "bab" (mis. materi tunggal yang dijelaskan pakai file foto/scan), tidak
    // ikut terpecah - guru/admin di jalur itu memang bermaksud membuat SATU materi saja.
    const babTerpisah = req.file && mode !== 'manual' ? pisahPerBab(konten) : [];

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

    // Kalau cuma 1 bab terdeteksi, pakai konten yang SUDAH dipotong dari pisahPerBab (bukan konten
    // mentah) - supaya "Kunci Jawaban" tetap tersaring walau tidak sampai terpecah jadi banyak materi.
    // Jalur "Tulis Materi Manual" (mode='manual') sengaja tidak ikut disaring - guru/admin di jalur
    // itu mengetik/tempel sendiri dan bertanggung jawab atas isinya.
    let kontenFinal =
      babTerpisah.length === 1
        ? babTerpisah[0].konten
        : req.file && mode !== 'manual'
          ? potongSebelumKunciJawaban(konten)
          : konten;

    if (!kontenFinal || !kontenFinal.trim()) {
      throw new ApiError(
        'Seluruh isi file ini terdeteksi sebagai bagian "Kunci Jawaban" - tidak ada konten aman yang bisa disimpan ke RAG.',
        400
      );
    }

    let materi = await Materi.create({
      judul,
      mapel: mapelDoc._id,
      jenjang,
      kelas,
      bab: bab || babTerpisah[0]?.bab,
      konten: kontenFinal,
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
