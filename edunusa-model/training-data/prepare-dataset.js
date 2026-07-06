/**
 * prepare-dataset.js
 *
 * Menggabungkan materi kurikulum (folder /edunusa-model/kurikulum/) dengan dataset
 * identitas EduNusa (identity.jsonl) menjadi satu dataset JSONL siap pakai untuk
 * fine-tuning: /edunusa-model/training-data/dataset-final.jsonl
 *
 * Cara pakai:
 *   node prepare-dataset.js
 */

const fs = require('fs');
const path = require('path');

const KURIKULUM_DIR = path.join(__dirname, '..', 'kurikulum');
const IDENTITY_PATH = path.join(__dirname, 'identity.jsonl');
const OUTPUT_PATH = path.join(__dirname, 'dataset-final.jsonl');

const EKSTENSI_DIDUKUNG = ['.txt', '.pdf'];
const UKURAN_CHUNK = 800; // karakter per bagian materi

// --- ekstraksi teks per format file ---

async function ekstrakTeksDariFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }

  throw new Error(`Format file tidak didukung: ${ext}`);
}

// --- deteksi bab/bagian dari teks mentah ---

const POLA_HEADING = /^(bab\s+\S+|BAB\s+\S+|kegiatan belajar\s+\S+|[0-9]+\.\s+.+|[A-Z]\.\s+.+)/;

function pisahPerBagian(teks) {
  const baris = teks.replace(/\r\n/g, '\n').split('\n');
  const bagianList = [];
  let judulSaatIni = null;
  let isiSaatIni = [];

  function simpanBagian() {
    const isi = isiSaatIni.join('\n').trim();
    if (isi.length > 0) {
      bagianList.push({ judul: judulSaatIni, isi });
    }
  }

  for (const baris_ of baris) {
    const trimmed = baris_.trim();
    if (trimmed.length > 0 && trimmed.length < 120 && POLA_HEADING.test(trimmed)) {
      simpanBagian();
      judulSaatIni = trimmed;
      isiSaatIni = [];
    } else {
      isiSaatIni.push(baris_);
    }
  }
  simpanBagian();

  // Jika tidak ada heading terdeteksi sama sekali, potong per ukuran chunk saja.
  if (bagianList.length === 0 || (bagianList.length === 1 && !bagianList[0].judul)) {
    const teksBersih = teks.replace(/\r\n/g, '\n').trim();
    const potongan = [];
    for (let i = 0; i < teksBersih.length; i += UKURAN_CHUNK) {
      potongan.push(teksBersih.slice(i, i + UKURAN_CHUNK));
    }
    return potongan.map((isi) => ({ judul: null, isi: isi.trim() })).filter((b) => b.isi.length > 0);
  }

  // Pecah bagian yang terlalu panjang agar tetap ringkas untuk fine-tuning.
  const hasil = [];
  bagianList.forEach(({ judul, isi }) => {
    if (isi.length <= UKURAN_CHUNK * 1.5) {
      hasil.push({ judul, isi });
      return;
    }
    for (let i = 0; i < isi.length; i += UKURAN_CHUNK) {
      hasil.push({ judul, isi: isi.slice(i, i + UKURAN_CHUNK).trim() });
    }
  });

  return hasil.filter((b) => b.isi.length > 30);
}

function tebakMapel(namaFile) {
  const base = path.basename(namaFile, path.extname(namaFile));
  const bagianPertama = base.split(/[-_\s]+/)[0];
  return bagianPertama.charAt(0).toUpperCase() + bagianPertama.slice(1).toLowerCase();
}

function buatPasanganInstruksi({ judul, isi }, mapel) {
  const instruction = judul
    ? `Jelaskan materi tentang "${judul}" pada mata pelajaran ${mapel}.`
    : `Jelaskan salah satu bagian materi pada mata pelajaran ${mapel} berikut ini.`;

  return {
    instruction,
    output: isi,
    kategori: 'kurikulum',
    mapel,
  };
}

// --- proses utama ---

async function bacaSemuaFileKurikulum() {
  if (!fs.existsSync(KURIKULUM_DIR)) {
    return [];
  }

  return fs
    .readdirSync(KURIKULUM_DIR)
    .filter((f) => EKSTENSI_DIDUKUNG.includes(path.extname(f).toLowerCase()))
    .map((f) => path.join(KURIKULUM_DIR, f));
}

async function main() {
  console.log('=== Menyiapkan dataset fine-tuning EduNusa ===\n');

  const fileKurikulum = await bacaSemuaFileKurikulum();
  console.log(`Ditemukan ${fileKurikulum.length} file kurikulum (.txt/.pdf) di ${path.relative(process.cwd(), KURIKULUM_DIR)}`);

  const samplesKurikulum = [];
  for (const filePath of fileKurikulum) {
    const namaFile = path.basename(filePath);
    try {
      const teks = await ekstrakTeksDariFile(filePath);
      const mapel = tebakMapel(namaFile);
      const bagianList = pisahPerBagian(teks);

      bagianList.forEach((bagian) => {
        samplesKurikulum.push(buatPasanganInstruksi(bagian, mapel));
      });

      console.log(`  ✓ ${namaFile} -> ${bagianList.length} bagian (mapel: ${mapel})`);
    } catch (err) {
      console.error(`  ✗ Gagal memproses ${namaFile}: ${err.message}`);
    }
  }

  if (fileKurikulum.length === 0) {
    console.log('  (belum ada file kurikulum, lihat kurikulum/README.md untuk cara menambahkannya)');
  }

  let samplesIdentity = [];
  if (fs.existsSync(IDENTITY_PATH)) {
    samplesIdentity = fs
      .readFileSync(IDENTITY_PATH, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } else {
    console.warn('Peringatan: identity.jsonl tidak ditemukan, dataset akan berjalan tanpa data identitas.');
  }

  const semuaSample = [...samplesIdentity, ...samplesKurikulum];

  fs.writeFileSync(OUTPUT_PATH, semuaSample.map((s) => JSON.stringify(s)).join('\n') + '\n');

  // --- statistik ---
  const distribusiKategori = {};
  const distribusiMapel = {};

  semuaSample.forEach((s) => {
    const kategori = s.kategori || 'lainnya';
    distribusiKategori[kategori] = (distribusiKategori[kategori] || 0) + 1;

    if (s.mapel) {
      distribusiMapel[s.mapel] = (distribusiMapel[s.mapel] || 0) + 1;
    }
  });

  console.log('\n=== Statistik Dataset ===');
  console.log(`Total sampel: ${semuaSample.length}`);
  console.log(`  - Identitas EduNusa: ${samplesIdentity.length}`);
  console.log(`  - Materi kurikulum: ${samplesKurikulum.length}`);

  console.log('\nDistribusi per kategori:');
  Object.entries(distribusiKategori).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  if (Object.keys(distribusiMapel).length > 0) {
    console.log('\nDistribusi per mapel (dari kurikulum):');
    Object.entries(distribusiMapel).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  }

  console.log(`\n✓ Dataset final disimpan di: ${path.relative(process.cwd(), OUTPUT_PATH)}`);

  return {
    totalSampel: semuaSample.length,
    totalIdentitas: samplesIdentity.length,
    totalKurikulum: samplesKurikulum.length,
    distribusiKategori,
    distribusiMapel,
    outputPath: OUTPUT_PATH,
  };
}

module.exports = { jalankan: main };

if (require.main === module) {
  main().catch((err) => {
    console.error('Gagal menyiapkan dataset:', err);
    process.exit(1);
  });
}
