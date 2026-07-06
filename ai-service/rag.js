const { chat } = require('./ollama');
const { queryDocuments } = require('./embeddings');

const AMBANG_RELEVAN = 0.55;
const PESAN_TIDAK_TAHU = 'Maaf, materi ini belum tersedia di EduNusa.';

// Kamus percakapan ringan: sapaan/basa-basi dibalas langsung tanpa lewat pipeline RAG,
// supaya obrolan biasa tidak ditolak dengan "materi belum tersedia".
// Pola dibuat anchored (^...$) agar pertanyaan materi sungguhan tidak ikut tertangkap.
const SMALL_TALK = [
  {
    pola: /^(halo+|hai+|he+i|hi+|hello+|hallo+|assalamu'?alaikum|selamat (pagi|siang|sore|malam))( (edunusa|kak|bang|min))?[\s!.,?]*$/i,
    jawaban: 'Halo! Aku EduNusa, asisten belajarmu. Ada materi pelajaran yang ingin kamu tanyakan hari ini?',
  },
  {
    pola: /^(apa kabar|gimana kabar(mu|nya)?|bagaimana kabarmu)[\s!.,?]*$/i,
    jawaban: 'Kabarku baik, terima kasih sudah bertanya! Aku siap menemanimu belajar. Ada materi yang mau kamu bahas?',
  },
  {
    pola: /^(siapa (sih )?(kamu|namamu)|kamu (ini |itu )?siapa( sih)?|siapa nama(mu| kamu)|nama(mu| kamu)( siapa| apa)|perkenalkan dirimu|kenalan (dong|yuk))[\s!.,?]*$/i,
    jawaban: 'Aku EduNusa, asisten belajar AI yang dikembangkan oleh tim EduNusa untuk membantu siswa di daerah 3T memahami pelajaran SD, SMP, dan SMA sesuai kurikulum Kemendikbud.',
  },
  {
    pola: /^(siapa yang (membuat|menciptakan|mengembangkan)(mu| kamu)|kamu buatan siapa|dibuat oleh siapa)[\s!.,?]*$/i,
    jawaban: 'Aku dikembangkan oleh tim EduNusa, inisiatif non-profit untuk pemerataan pendidikan di daerah Terdepan, Terluar, dan Tertinggal (3T) Indonesia.',
  },
  {
    pola: /^(kamu bisa (apa( saja| aja)?|ngapain( aja| saja)?)|apa (saja |aja )?yang bisa kamu( lakukan| bantu)?|apa kemampuanmu|bisa bantu apa( saja| aja)?)[\s!.,?]*$/i,
    jawaban: 'Aku bisa menjelaskan materi pelajaran sesuai kurikulum yang diunggah gurumu, membuatkan soal latihan, dan menjawab pertanyaan seputar pelajaran. Coba tanyakan topik dari materi yang sedang kamu pelajari!',
  },
  {
    pola: /^((kamu )?bisa (tolong )?bantu (aku|saya)( g?a?k| tidak|kah| dong| ya)?)[\s!.,?]*$/i,
    jawaban: 'Tentu bisa! Ceritakan materi atau soal apa yang sedang kamu pelajari, nanti aku bantu jelaskan.',
  },
  {
    pola: /^(terima ?kasih|makasih|thanks|thank you|trims|tengkyu)( banyak| ya| kak| edunusa)?[\s!.,?]*$/i,
    jawaban: 'Sama-sama! Senang bisa membantu. Kalau ada pertanyaan lain, tanya saja ya.',
  },
  {
    pola: /^(sampai jumpa|da+h|da+da+h|bye+|selamat tinggal|good ?bye)[\s!.,?]*$/i,
    jawaban: 'Sampai jumpa! Semangat belajarnya, ya!',
  },
  {
    pola: /^(ok(e|ay)?|sip+|baik(lah)?|mantap|keren|wow)[\s!.,?]*$/i,
    jawaban: 'Siap! Lanjut belajar, ya. Tanya aku kapan saja kalau ada materi yang membingungkan.',
  },
];

function cekSmallTalk(pertanyaan) {
  const teks = String(pertanyaan || '').trim().replace(/\s+/g, ' ');
  if (!teks || teks.length > 80) return null;
  const cocok = SMALL_TALK.find((item) => item.pola.test(teks));
  return cocok ? cocok.jawaban : null;
}

function buildSystemPrompt(jenjang) {
  const levelInstruksi = {
    SD: 'Jelaskan dengan kata-kata yang sangat sederhana, contoh konkret, dan kalimat pendek, seperti untuk anak Sekolah Dasar.',
    SMP: 'Jelaskan dengan bahasa sederhana namun cukup detail, seperti untuk siswa Sekolah Menengah Pertama.',
    SMA: 'Jelaskan dengan bahasa yang lebih mendalam dan istilah yang sesuai, seperti untuk siswa Sekolah Menengah Atas.',
  };

  return (
    'Kamu adalah EduNusa, asisten belajar AI untuk siswa di daerah 3T (Terdepan, Terluar, Tertinggal). ' +
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

  // Percakapan ringan dijawab langsung dari kamus, tanpa embed/model.
  const jawabanSmallTalk = cekSmallTalk(pertanyaan);
  if (jawabanSmallTalk) {
    return { jawaban: jawabanSmallTalk, sumber: [], smallTalk: true };
  }

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

module.exports = { tanyaAI, generateSoal, PESAN_TIDAK_TAHU };
