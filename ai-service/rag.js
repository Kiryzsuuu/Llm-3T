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
    // Cocok untuk pertanyaan kemampuan umum seperti "apakah kamu bisa bantu aku belajar",
    // "kamu bisa bantu aku gak", "bisa bantu aku belajar ya" — tapi TIDAK untuk pertanyaan
    // konten spesifik seperti "bisa bantu aku paham hukum newton" (dilempar ke RAG seperti biasa).
    pola: /^(apa(kah)?\s+)?(kamu\s+bisa(kah)?|bisa(kah)?\s+kamu|bisa(kah)?)\s+(tolong\s+)?(bantu|membantu)\s+(aku|saya)(\s+(belajar|dong|ya|g?a?k|tidak|enggak|nggak))*[\s!.,?]*$/i,
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

const LEVEL_INSTRUKSI = {
  SD: 'Jelaskan dengan kata-kata yang sangat sederhana, contoh konkret, dan kalimat pendek, seperti untuk anak Sekolah Dasar.',
  SMP: 'Jelaskan dengan bahasa sederhana namun cukup detail, seperti untuk siswa Sekolah Menengah Pertama.',
  SMA: 'Jelaskan dengan bahasa yang lebih mendalam dan istilah yang sesuai, seperti untuk siswa Sekolah Menengah Atas.',
};

// System prompt dasar dipakai di kedua tahap Socratic (pertanyaan_baru & mengevaluasi_jawaban_siswa).
// Poin 2 (anti-campur-sumber) langsung menyasar Bug 3.1 di EDUNUSA_CATATAN_PERBAIKAN.md:
// jawaban salah materi karena chunk yang di-retrieve berisi beberapa poin/sila/pasal sekaligus
// dan model mencampur/salah pilih salah satunya.
function buildSystemPrompt({ jenjang, tahap }) {
  const dasar =
    'Kamu adalah EduNusa, asisten belajar AI untuk siswa SD, SMP, dan SMA di daerah 3T ' +
    '(Terdepan, Terluar, Tertinggal), sesuai kurikulum Kemendikbud.\n\n' +
    'ATURAN SUMBER (WAJIB):\n' +
    '1. Jawaban HANYA boleh bersumber dari konteks materi yang diberikan di bawah. Jangan menambahkan pengetahuan di luar konteks itu.\n' +
    '2. Jika konteks berisi beberapa sumber/poin sekaligus, PILIH HANYA bagian yang benar-benar relevan dengan pertanyaan spesifik yang ditanyakan. ' +
    'JANGAN mencampur atau tertukar dengan informasi dari poin, sila, pasal, ayat, atau sub-topik lain yang berbeda dari yang ditanyakan.\n' +
    '3. Jangan mengarang jawaban (jangan berhalusinasi).\n' +
    `4. Gunakan Bahasa Indonesia yang mudah dipahami. ${LEVEL_INSTRUKSI[jenjang] || LEVEL_INSTRUKSI.SMP}\n`;

  if (tahap === 'mengevaluasi_jawaban_siswa') {
    return (
      dasar +
      '\nATURAN TAHAP EVALUASI JAWABAN SISWA:\n' +
      '- Kamu diberi: pertanyaan awal siswa, konteks materi, dan jawaban percobaan siswa.\n' +
      '- Bandingkan jawaban siswa dengan konteks materi (boleh beda kata asal maknanya sesuai).\n' +
      '- Jika BENAR: beri apresiasi singkat, lalu tambahkan penjelasan singkat untuk memperkuat pemahaman.\n' +
      '- Jika SALAH atau kurang tepat: sebutkan jawaban yang benar beserta penjelasan singkat kenapa, ' +
      'dengan bahasa yang suportif dan tidak menghakimi.\n' +
      '- Ini penutup dari satu putaran tanya-jawab. Jangan bertanya balik lagi di tahap ini.'
    );
  }

  // tahap default: 'pertanyaan_baru'
  return (
    dasar +
    '\nATURAN TAHAP AWAL (SOCRATIC — WAJIB DIIKUTI):\n' +
    '- JANGAN langsung memberi jawaban akhir dari pertanyaan siswa, walau jawabannya ada di konteks materi.\n' +
    '- Beri penjelasan/konteks singkat seputar topik yang relevan dari materi, TANPA menyebutkan jawaban akhirnya, ' +
    'baik secara eksplisit maupun tersirat yang terlalu jelas.\n' +
    '- Tutup responsmu dengan SATU pertanyaan balik singkat yang mengajak siswa mencoba menjawab sendiri ' +
    '(misalnya "Menurutmu, apa jawabannya?").\n' +
    '- Jangan bocorkan jawaban akhirnya dalam bentuk apapun di tahap ini, termasuk menyebut nama/istilah kunci ' +
    'yang sebenarnya adalah jawabannya.\n\n' +
    'CONTOH SALAH (jangan ditiru — ini membocorkan jawaban):\n' +
    'Siswa: "Apa lambang sila ke-3?"\n' +
    'Kamu (SALAH): "Sila ke-3 adalah Persatuan Indonesia, dilambangkan pohon beringin. Menurutmu apa lambangnya?" ' +
    '<- SALAH karena jawaban (pohon beringin) sudah disebut duluan sebelum siswa sempat menjawab.\n\n' +
    'CONTOH BENAR (konteks tanpa membocorkan jawaban):\n' +
    'Siswa: "Apa lambang sila ke-3?"\n' +
    'Kamu (BENAR): "Sila ke-3 berbunyi \'Persatuan Indonesia\'. Lambang tiap sila biasanya punya makna yang ' +
    'berhubungan dengan bunyinya — sesuatu yang kuat, berakar, dan jadi tempat berteduh bersama. ' +
    'Menurutmu, lambang apa yang cocok untuk itu?"\n\n' +
    'CONTOH SALAH KEDUA (berlaku juga untuk pertanyaan tanggal/angka/fakta, bukan cuma istilah):\n' +
    'Siswa: "Kapan Pancasila disahkan?"\n' +
    'Kamu (SALAH): "Pancasila disahkan pada tanggal 18 Agustus 1945. Kamu tahu kapan itu terjadi?" ' +
    '<- SALAH, tanggalnya (yang justru jadi jawaban pertanyaan) sudah disebut duluan.\n\n' +
    'CONTOH BENAR KEDUA:\n' +
    'Siswa: "Kapan Pancasila disahkan?"\n' +
    'Kamu (BENAR): "Pancasila disahkan tidak lama setelah Indonesia merdeka pada 17 Agustus 1945 — ' +
    'kira-kira berapa hari setelah kemerdekaan itu ya? Coba tebak tanggal pastinya!"\n\n' +
    'ATURAN KHUSUS ANGKA/TANGGAL/NAMA: kalau jawaban akhirnya berupa angka, tanggal, atau nama spesifik yang ' +
    'ada di konteks, JANGAN sebutkan angka/tanggal/nama itu sama sekali di tahap ini — ganti dengan petunjuk ' +
    'di sekitarnya saja (mis. peristiwa terkait, rentang waktu perkiraan, ciri-ciri), lalu tanya balik.'
  );
}

// Confidence dihitung dari similarity chunk PALING relevan (top-1), bukan rata-rata seluruh chunk
// yang di-retrieve. Alasan (Bug 3.2 di catatan perbaikan): merata-ratakan bisa "mengencerkan" skor
// walau chunk teratas sebenarnya sangat cocok, hanya karena chunk ke-2/3 kurang relevan.
function hitungConfidence(hasil) {
  const skorList = (hasil.distances && hasil.distances[0]) || [];
  if (skorList.length === 0) return 0;

  const similarities = skorList.map((d) => 1 - d);
  const top = Math.max(...similarities);
  return Math.max(0, Math.min(1, Number(top.toFixed(3))));
}

// Kata umum Bahasa Indonesia yang diabaikan saat mengecek kecocokan kata kunci — supaya yang
// dibandingkan benar-benar kata bermakna (topik), bukan kata tanya/penghubung generik.
const STOPWORD = new Set([
  'apa', 'apakah', 'siapa', 'kapan', 'dimana', 'mengapa', 'kenapa', 'bagaimana', 'berapa',
  'di', 'ke', 'yang', 'dan', 'atau', 'untuk', 'dari', 'pada', 'adalah', 'itu', 'ini',
  'kamu', 'aku', 'saya', 'kita', 'kami', 'bisa', 'akan', 'dengan', 'ada', 'tidak', 'juga',
  'saja', 'sih', 'dong', 'coba', 'sebuah', 'suatu', 'para', 'oleh',
]);

function ambilKataKunci(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORD.has(w));
}

// Gerbang leksikal tambahan di atas embedding similarity (hybrid retrieval). Diperlukan karena
// nomic-embed-text punya "baseline" kemiripan yang cukup tinggi antar kalimat Bahasa Indonesia
// apapun topiknya — beberapa chunk (terutama kalimat pembuka yang generik) bisa tampak mirip
// secara cosine similarity dengan pertanyaan yang SAMA SEKALI tidak berkaitan (mis. "siapa
// presiden Amerika?" vs materi Pancasila). Kalau tidak ada satu pun kata kunci pertanyaan yang
// muncul di salah satu chunk teratas, anggap tidak relevan meski skor cosine-nya tinggi.
function adaKecocokanKataKunci(pertanyaan, dokumen) {
  const kataKunci = ambilKataKunci(pertanyaan);
  if (kataKunci.length === 0) return true; // pertanyaan terlalu pendek/generik untuk dicek, jangan blokir

  return dokumen.some((teks) => {
    const lower = teks.toLowerCase();
    return kataKunci.some((k) => lower.includes(k));
  });
}

async function retrieveContext(pertanyaan, filter = {}) {
  const { materi_id } = filter;
  const where = materi_id ? { materi_id: String(materi_id) } : undefined;

  const hasil = await queryDocuments(pertanyaan, 4, where);
  const dokumen = (hasil.documents && hasil.documents[0]) || [];
  const metadatas = (hasil.metadatas && hasil.metadatas[0]) || [];
  let confidence = hitungConfidence(hasil);
  const konteks = dokumen.map((d, i) => `[Sumber ${i + 1}]\n${d}`).join('\n\n');

  if (dokumen.length > 0 && !adaKecocokanKataKunci(pertanyaan, dokumen)) {
    confidence = 0;
  }

  return { dokumen, metadatas, confidence, konteks };
}

const NAMA_BULAN = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember';
const POLA_TANGGAL = new RegExp(`\\b\\d{1,2}\\s+(?:${NAMA_BULAN})\\s+\\d{4}\\b`, 'gi');

// Pengaman deterministik di level kode (bukan cuma prompt): model kecil (2B) terbukti dari
// pengujian TETAP konsisten membocorkan tanggal/angka spesifik di tahap awal walau sudah
// diberi instruksi + contoh few-shot eksplisit (lihat EDUNUSA_CATATAN_PERBAIKAN.md bagian 5).
// Kalau tanggal yang sama persis muncul baik di konteks sumber maupun di jawaban model,
// itu hampir pasti jawaban akhir yang bocor — sensor supaya siswa tetap harus mencoba menjawab.
function sensorTanggalBocor(jawaban, konteks) {
  const tanggalDiKonteks = new Set((konteks.match(POLA_TANGGAL) || []).map((t) => t.toLowerCase()));
  if (tanggalDiKonteks.size === 0) return jawaban;

  return jawaban.replace(POLA_TANGGAL, (cocok) =>
    tanggalDiKonteks.has(cocok.toLowerCase()) ? '(tanggal tertentu — coba tebak sendiri!)' : cocok
  );
}

async function chatPertanyaanBaru({ pertanyaan, konteks, jenjang }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ jenjang, tahap: 'pertanyaan_baru' }) },
    { role: 'user', content: `Konteks materi:\n${konteks}\n\nPertanyaan siswa: ${pertanyaan}` },
  ];
  // Temperature rendah di tahap ini supaya model lebih konsisten patuh pada aturan
  // "jangan bocorkan jawaban akhir" — pada model kecil (2B), temperature lebih tinggi
  // membuat kepatuhan pada instruksi ini jadi tidak konsisten antar percobaan.
  const jawaban = await chat(messages, { temperature: 0.1 });
  return sensorTanggalBocor(jawaban, konteks);
}

async function chatEvaluasiJawaban({ pertanyaanAsli, konteks, jawabanSiswa, jenjang }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ jenjang, tahap: 'mengevaluasi_jawaban_siswa' }) },
    {
      role: 'user',
      content:
        `Konteks materi:\n${konteks}\n\n` +
        `Pertanyaan awal siswa: ${pertanyaanAsli}\n\n` +
        `Jawaban percobaan siswa: ${jawabanSiswa}`,
    },
  ];
  return chat(messages);
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

module.exports = {
  PESAN_TIDAK_TAHU,
  AMBANG_RELEVAN,
  cekSmallTalk,
  retrieveContext,
  chatPertanyaanBaru,
  chatEvaluasiJawaban,
  generateSoal,
};
