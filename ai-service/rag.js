const { chat } = require('./ollama');
const { queryDocuments } = require('./embeddings');

const AMBANG_RELEVAN = 0.55;
const PESAN_TIDAK_TAHU = 'Maaf, materi ini belum tersedia.';

function buildSystemPrompt(jenjang) {
  const levelInstruksi = {
    SD: 'Jelaskan dengan kata-kata yang sangat sederhana, contoh konkret, dan kalimat pendek, seperti untuk anak Sekolah Dasar.',
    SMP: 'Jelaskan dengan bahasa sederhana namun cukup detail, seperti untuk siswa Sekolah Menengah Pertama.',
    SMA: 'Jelaskan dengan bahasa yang lebih mendalam dan istilah yang sesuai, seperti untuk siswa Sekolah Menengah Atas.',
  };

  return (
    'Kamu adalah AI Tutor untuk siswa di daerah 3T (Terdepan, Terluar, Tertinggal). ' +
    'ATURAN WAJIB:\n' +
    '1. HANYA jawab berdasarkan konteks materi yang diberikan di bawah. Jangan menambahkan pengetahuan di luar konteks.\n' +
    `2. Jika konteks tidak memuat jawaban, balas persis: "${PESAN_TIDAK_TAHU}"\n` +
    '3. Gunakan Bahasa Indonesia yang mudah dipahami.\n' +
    `4. ${levelInstruksi[jenjang] || levelInstruksi.SMP}\n` +
    '5. Jangan mengarang jawaban (jangan berhalusinasi).'
  );
}

function hitungConfidence(hasil) {
  const skorList = (hasil.distances && hasil.distances[0]) || [];
  if (skorList.length === 0) return 0;

  const similarities = skorList.map((d) => 1 - d);
  const rerata = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  return Math.max(0, Math.min(1, Number(rerata.toFixed(3))));
}

async function tanyaAI(pertanyaan, filter = {}) {
  const { materi_id, jenjang } = filter;
  const where = materi_id ? { materi_id: String(materi_id) } : undefined;

  // a. embed pertanyaan + b. cari 3 chunk paling relevan (dilakukan di dalam queryDocuments)
  const hasil = await queryDocuments(pertanyaan, 3, where);

  const dokumen = (hasil.documents && hasil.documents[0]) || [];
  const metadatas = (hasil.metadatas && hasil.metadatas[0]) || [];
  const confidence = hitungConfidence(hasil);

  if (dokumen.length === 0 || confidence < AMBANG_RELEVAN) {
    return {
      jawaban: PESAN_TIDAK_TAHU,
      sumber: [],
      confidence,
    };
  }

  const konteks = dokumen.map((d, i) => `[Sumber ${i + 1}]\n${d}`).join('\n\n');

  // c. buat prompt dengan konteks + batasan kurikulum
  const messages = [
    { role: 'system', content: buildSystemPrompt(jenjang) },
    {
      role: 'user',
      content: `Konteks materi:\n${konteks}\n\nPertanyaan siswa: ${pertanyaan}`,
    },
  ];

  // d. kirim ke Gemma 2B via Ollama
  const jawaban = await chat(messages);

  // e. return { jawaban, sumber, confidence }
  return {
    jawaban,
    sumber: dokumen.map((text, i) => ({ text, metadata: metadatas[i] || {} })),
    confidence,
  };
}

async function generateSoal({ topik, materiId, jumlah = 5, tingkat_kesulitan = 'sedang' }) {
  const where = materiId ? { materi_id: String(materiId) } : undefined;
  const hasil = await queryDocuments(topik, 4, where);
  const dokumen = (hasil.documents && hasil.documents[0]) || [];
  const konteks = dokumen.join('\n\n---\n\n');

  const messages = [
    {
      role: 'system',
      content:
        'Kamu adalah pembuat soal pilihan ganda untuk siswa 3T (Terdepan, Terluar, Tertinggal). ' +
        'Buat soal berdasarkan topik dan konteks materi yang diberikan. ' +
        'Balas HANYA dengan JSON array yang valid, tanpa teks lain, dengan format setiap elemen: ' +
        '{"pertanyaan": string, "pilihan": [string, string, string, string], "jawaban_benar": number(0-3), "penjelasan": string, "tingkat_kesulitan": "mudah"|"sedang"|"sulit"}.',
    },
    {
      role: 'user',
      content:
        `Topik: ${topik}\n` +
        (konteks ? `Konteks materi:\n${konteks}\n` : '') +
        `Jumlah soal: ${jumlah}\n` +
        `Tingkat kesulitan: ${tingkat_kesulitan}`,
    },
  ];

  const jawaban = await chat(messages);

  let soal;
  try {
    const match = jawaban.match(/\[[\s\S]*\]/);
    soal = JSON.parse(match ? match[0] : jawaban);
  } catch (err) {
    throw new Error('Gagal mem-parsing hasil soal dari AI');
  }

  return soal;
}

module.exports = { tanyaAI, generateSoal };
