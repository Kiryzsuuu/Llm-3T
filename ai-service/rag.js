const { chat } = require('./ollama');
const { queryDocuments } = require('./embeddings');
const { cariDanHitungEkspresi } = require('./calculator');
// Perilaku/kepribadian EduNusa (gaya bahasa, aturan sumber, alur Socratic) tersentral di satu
// tempat: edunusa-model/system-prompt.js. Edit di sana untuk mengubah cara EduNusa "berpikir",
// bukan di sini.
const { buildSystemPrompt } = require('../edunusa-model/system-prompt');

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
    jawaban: 'Aku EduNusa, asisten belajar AI yang dikembangkan oleh tim EduNusa untuk membantu siswa SD di daerah 3T memahami pelajaran sesuai kurikulum Kemendikbud.',
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

// "Aku mau nanya/belajar tentang X" itu PERNYATAAN MINAT topik, bukan pertanyaan spesifik - kalau
// tetap dipaksa masuk alur Socratic penuh (retrieval + tanya-balik + tunggu-jawaban), modelnya
// kebingungan karena tidak ada pertanyaan konkret untuk dievaluasi (terbukti dari pengujian nyata:
// alurnya jadi kacau berputar-putar, sampai model menyuruh siswa "baca sumber 1" alih-alih
// menjawab). Direspons deterministik di kode (TIDAK lewat LLM/RAG, TIDAK membuka sesi Socratic) -
// giliran berikutnya siswa tetap bebas bertanya spesifik dan itu baru masuk alur normal.
const POLA_PERNYATAAN_MINAT = /^(aku|saya|gue|gw)\s+(mau|ingin|pengen)\s+(nanya|tanya|belajar|tahu|mengetahui)\s+(tentang|soal|mengenai)\s+(.+)/i;

function cekPernyataanMinat(pertanyaan) {
  const cocok = String(pertanyaan || '').trim().match(POLA_PERNYATAAN_MINAT);
  if (!cocok) return null;
  const topik = cocok[5].trim().replace(/[.!?]+$/, '');
  if (!topik) return null;
  return `Oke, mau tahu apa soal **${topik}**? Coba tanya yang lebih spesifik ya, misalnya "apa itu ${topik}" atau "jelaskan ${topik}".`;
}

// Titik keputusan penting: TIDAK SELALU pertanyaan baru harus lewat alur Socratic (tahan jawaban +
// tanya balik + tunggu siswa mencoba dulu) - per masukan eksplisit pengguna, itu bikin banyak
// pertanyaan wajar (mis. "apa manfaat olahraga?", "jelaskan gotong royong") terasa berbelit-belit
// dan tidak membantu kalau tetap dipaksa menebak dulu. DEFAULT SEKARANG LANGSUNG MENJELASKAN;
// Socratic jadi PENGECUALIAN, dipertahankan KHUSUS untuk pertanyaan dengan SATU jawaban spesifik
// yang layak ditebak - fakta/lambang/tanggal/angka/nama tunggal (mis. "apa lambang sila ke-3?",
// "kapan Pancasila disahkan?", "berapa 7x8?", "siapa presiden pertama Indonesia?") - di situ
// menebak dulu sungguh membantu pemahaman, beda dari sekadar minta dijelaskan/diuraikan.
const POLA_FAKTA_TUNGGAL_SOCRATIC =
  /^(apa\s+(lambang|arti|makna|bunyi|nama|singkatan)|kapan|berapa|siapa|di\s?mana|sila\s+ke|pasal\s+ke|ayat\s+ke)\b/i;

function butuhModeSocratic(pertanyaan) {
  return POLA_FAKTA_TUNGGAL_SOCRATIC.test(String(pertanyaan || '').trim());
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
  // Kata penghubung waktu/generik - terbukti dari pengujian (dataset 8 buku SD asli) muncul di
  // hampir semua konteks apa pun topiknya, sehingga kalau tidak difilter bisa meloloskan chunk
  // yang sama sekali tidak relevan lewat gerbang kata kunci hanya karena kebetulan sama-sama
  // memuat kata generik ini (mis. "saat" muncul di teks tentang pseudocode maupun tentang pilek,
  // tidak ada hubungannya dengan pertanyaan sungguhan).
  'saat', 'ketika', 'sekarang', 'sedang', 'sering', 'selalu', 'pernah', 'tadi', 'nanti',
  'dulu', 'kini', 'lalu', 'setelah', 'sebelum', 'saja', 'masih', 'sudah', 'belum', 'sambil',
  // Kata urutan/generik yang terbukti dari pengujian nyata (testing masif lintas mapel) meloloskan
  // pertanyaan DI LUAR CAKUPAN lewat gerbang kata kunci - mis. "siapa presiden pertama Mesir Kuno?"
  // lolos hanya karena kata "pertama" kebetulan muncul di banyak konten tak berkaitan (mis. "sila
  // pertama", "langkah pertama"), padahal kata kunci sungguhannya ("presiden", "mesir", "kuno")
  // sama sekali tidak ada di materi manapun.
  'pertama', 'kedua', 'ketiga', 'terakhir', 'utama',
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
// presiden Amerika?" vs materi Pancasila).
//
// PENTING: cuma cek chunk PALING ATAS (dokumen[0]), bukan "ada di salah satu dari 4 chunk manapun"
// seperti sebelumnya. Terbukti dari pengujian dengan vector store besar (7900+ chunk dari 8 buku
// asli): begitu jumlah & keragaman chunk banyak, kata kunci generik apa pun (mis. "saat") hampir
// selalu nyangkut di SALAH SATU dari 4 chunk secara kebetulan, walau chunk TERATAS (yang benar-benar
// menentukan skor confidence lewat hitungConfidence) sama sekali tidak relevan — meloloskan
// pertanyaan di luar cakupan seperti "siapa presiden Amerika Serikat saat ini?" secara tidak sengaja.
function adaKecocokanKataKunci(pertanyaan, dokumen) {
  const kataKunci = ambilKataKunci(pertanyaan);
  if (kataKunci.length === 0) return true; // pertanyaan terlalu pendek/generik untuk dicek, jangan blokir
  if (dokumen.length === 0) return true;

  const teratas = dokumen[0].toLowerCase();
  return kataKunci.some((k) => teratas.includes(k));
}

// Deteksi rujukan urutan eksplisit di pertanyaan (mis. "sila ke-2", "pasal ke-3") dan PERSEMPIT
// konteks jadi HANYA chunk yang cocok urutannya itu, buang semua chunk lain. Awalnya ini cuma
// menaruh chunk yang cocok di posisi pertama (bukan filter), tapi dari pengujian terbukti model
// kecil (Qwen2.5:1.5b) TETAP bisa salah pilih walau chunk yang benar sudah di posisi pertama,
// begitu masih ada chunk "pengalih perhatian" lain yang mirip topik (mis. sila lain) di konteks
// yang sama. Filter total (bukan cuma reorder) menghilangkan ambiguitas ini di akar masalahnya -
// model tidak punya opsi untuk salah pilih kalau cuma diberi satu sumber yang relevan.
const POLA_ORDINAL_PERTANYAAN = /ke[- ]?(\d+)\b/i;

function cocokOrdinalChunk(teks, angka) {
  const awalTeks = teks.trim().slice(0, 60);
  return new RegExp(`^${angka}[.)]`).test(teks.trim()) || new RegExp(`ke[- ]?${angka}\\b`, 'i').test(awalTeks);
}

function prioritaskanOrdinal(dokumen, metadatas, pertanyaan) {
  const cocokAngka = pertanyaan.match(POLA_ORDINAL_PERTANYAAN);
  if (!cocokAngka) return { dokumen, metadatas, ordinalTakDitemukan: false };

  const angka = cocokAngka[1];
  const idx = dokumen.findIndex((d) => cocokOrdinalChunk(d, angka));
  if (idx === -1) {
    // Tidak ada satu pun dari 4 chunk yang di-retrieve benar-benar menyebut urutan yang ditanya
    // (mis. "sila ke-1" tapi ke-4 chunk-nya cuma bahas sila lain / instruksi mengajar / lambang
    // negara) - terbukti dari pengujian nyata pada materi Buku Guru asli (bukan fixture bersih):
    // membiarkan retrieval "apa adanya" di sini membuat model mengevaluasi jawaban siswa TANPA
    // pegangan sungguhan, hasilnya tidak konsisten dan kadang-kadang jawaban BENAR malah divonis
    // salah. Ditandai di sini supaya retrieveContext bisa memaksa confidence ke 0 - jujur "belum
    // tersedia" jauh lebih aman daripada mengevaluasi dengan konteks yang salah urutan.
    return { dokumen, metadatas, ordinalTakDitemukan: true };
  }

  return { dokumen: [dokumen[idx]], metadatas: [metadatas[idx]], ordinalTakDitemukan: false };
}

// Kalau SEMUA chunk yang ter-retrieve pendek DAN tidak ada satupun yang berupa kalimat lengkap
// (ada tanda baca akhir kalimat), itu tandanya chunk-nya cuma judul/label topik (mis. dari daftar
// tujuan pembelajaran di awal bab) - BUKAN penjelasan sungguhan. Dari pengujian dengan buku
// Kemendikdasmen asli: model kecil (Qwen2.5:1.5b) terbukti nekat MENGARANG jawaban lengkap dari
// pengetahuan umumnya sendiri saat ini terjadi, alih-alih jujur bilang materinya belum cukup -
// jadi ditolak deterministik di level kode, jangan mengandalkan model menahan diri sendiri.
const PANJANG_MINIMAL_PENJELASAN = 100;

// Chunk yang isinya SENDIRI berupa perintah/soal latihan (mis. "4. Jelaskan manfaat praktik gotong
// royong di lingkungan masyarakat!" dari bagian "Uji Kompetensi"/"Ayo Berlatih") BUKAN penjelasan
// sungguhan walau diakhiri tanda baca kalimat lengkap - tanpa pengecualian ini, chunk soal latihan
// lolos gerbang "ada kalimat lengkap" dan model cuma menggemakan soalnya sendiri sebagai "jawaban"
// alih-alih benar-benar menjelaskan (terbukti dari pengujian nyata: "jelaskan gotong royong" dijawab
// "Jelaskan gotong royong!" - modelnya cuma mengulang chunk soal yang di-retrieve).
// Flag "s" (dotAll) WAJIB - teks chunk dari PDF sering ada baris baru di tengah kalimat (mis.
// "...lingkungan\nmasyarakat!"), dan "." di regex TIDAK otomatis cocok dengan baris baru tanpa flag
// ini - tanpa "s", pola ini gagal cocok pada persis kasus yang dicoba ditangkap (sudah teruji nyata).
const POLA_SOAL_LATIHAN = /^(jelaskan|sebutkan|tuliskan|ceritakan|diskusikan|uraikan|coba)\b.*[!?]$/is;

function adaKalimatLengkap(dokumen) {
  return dokumen.some((d) => {
    const tanpaPrefix = d.trim().replace(/^[a-z0-9]{1,3}[.)]\s*/i, '').replace(/\s+/g, ' ').trim();
    if (POLA_SOAL_LATIHAN.test(tanpaPrefix)) return false;
    // Buang titik/koma ribuan dalam angka (mis. "10.000", "1.500") supaya tidak salah dianggap
    // tanda titik akhir kalimat - umum banget di buku Matematika/IPAS.
    const tanpaAngka = tanpaPrefix.replace(/\d[.,]\d/g, '00');
    // Fragmen topik pendek dengan tanda tanya/seru menempel (mis. "gotong royong?", 2 kata) TIDAK
    // boleh ikut lolos cuma karena ada tanda baca di ekornya - terbukti dari pengujian nyata (4
    // chunk ter-retrieve semuanya cuma fragmen begini, membuat model mengulang salah satunya
    // sebagai "jawaban"). Ambang 4 kata dipilih supaya tetap meloloskan kalimat pendek tapi
    // sungguhan seperti fixture Pancasila ("Persatuan Indonesia, dilambangkan pohon beringin." -
    // 5 kata, WAJIB tetap lolos, sempat kepotong keliru saat ambang ini masih 6) sambil tetap
    // membuang fragmen 1-3 kata.
    const jumlahKata = tanpaPrefix.split(/\s+/).filter(Boolean).length;
    return /[.!?]/.test(tanpaAngka) && jumlahKata >= 4;
  });
}

function hanyaLabelTanpaPenjelasan(dokumen) {
  const terpanjang = Math.max(0, ...dokumen.map((d) => d.trim().length));
  return terpanjang < PANJANG_MINIMAL_PENJELASAN && !adaKalimatLengkap(dokumen);
}

async function retrieveContext(pertanyaan, filter = {}) {
  const { materi_id, mapel, percayaTanpaGerbangKataKunci } = filter;
  // Chat umum (dashboard, tanpa materi_id) bisa dikunci ke satu mapel lewat filter "mapel" -
  // supaya retrieval tidak mencari ke SELURUH vector store lintas mapel begitu pertanyaannya
  // ambigu (mis. "jelaskan tentang perkalian" bisa nyasar ke buku mapel lain yang kebetulan
  // menyebut kata serupa). materi_id tetap prioritas kalau ada (mode per-materi yang sudah lebih
  // spesifik dari mode per-mapel).
  const where = materi_id
    ? { materi_id: String(materi_id) }
    : mapel
      ? { mapel: String(mapel) }
      : undefined;

  const hasil = await queryDocuments(pertanyaan, 4, where);
  const mentah = (hasil.documents && hasil.documents[0]) || [];
  const metadataMentah = (hasil.metadatas && hasil.metadatas[0]) || [];
  const { dokumen, metadatas, ordinalTakDitemukan } = prioritaskanOrdinal(mentah, metadataMentah, pertanyaan);
  let confidence = hitungConfidence(hasil);
  const konteks = dokumen.map((d, i) => `[Sumber ${i + 1}]\n${d}`).join('\n\n');

  // Pertanyaan menyebut urutan spesifik (mis. "sila ke-1") tapi TIDAK ADA satu pun chunk yang
  // benar-benar cocok urutan itu - lihat komentar ordinalTakDitemukan di prioritaskanOrdinal().
  // Mengevaluasi jawaban siswa dengan konteks yang salah urutan lebih berbahaya daripada jujur
  // bilang belum tersedia (terbukti dari pengujian nyata: jawaban BENAR bisa divonis salah).
  if (ordinalTakDitemukan) {
    confidence = 0;
  }

  // Gerbang kata kunci dilewati KHUSUS saat pertanyaan berasal dari chip topik yang di-generate
  // dari label materi asli (bukan diketik bebas oleh siswa) - mis. "Jelaskan tentang Bab 4" gagal
  // lolos gerbang ini karena "bab" (3 huruf) & angka tidak dihitung kata kunci, dan konten aslinya
  // wajar tidak literal menyebut kata "jelaskan"/"tentang". Terbukti dari pengujian nyata: banyak
  // topik yang SUNGGUH ADA jadi salah dibilang "belum tersedia". Tetap AMAN dilewati di sini karena
  // labelnya sendiri berasal dari metadata materi asli (bukan tebakan bebas), beda dari pertanyaan
  // bebas siswa yang tetap wajib lewat gerbang ini untuk mencegah halusinasi di luar cakupan.
  if (dokumen.length > 0 && !percayaTanpaGerbangKataKunci && !adaKecocokanKataKunci(pertanyaan, dokumen)) {
    confidence = 0;
  }

  if (dokumen.length > 0 && hanyaLabelTanpaPenjelasan(dokumen)) {
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

// Model kecil kadang terjebak mengulang kalimat yang PERSIS SAMA berkali-kali sebelum num_predict
// menghentikannya paksa di batas token (repeat_penalty terbukti dari pengujian nyata malah
// memperparah pengulangan alih-alih menguranginya - lihat catatan di chatPertanyaanBaru, jadi
// sengaja tidak dipakai). Dibersihkan di sini secara deterministik sebagai lapis terakhir: begitu
// ada kalimat cukup panjang (>=20 karakter) yang sudah muncul sebelumnya di jawaban yang SAMA,
// potong jawabannya dari situ - lebih baik jawaban lebih pendek tapi bersih daripada panjang
// tapi mengulang-ulang kalimat yang sama.
function potongJawabanBerulang(jawaban) {
  const kalimat = jawaban.split(/(?<=[.!?])\s+/);
  const terlihat = new Set();
  const awalTerlihat = new Set();
  const hasil = [];
  for (const k of kalimat) {
    const bersih = k.trim().toLowerCase().replace(/\s+/g, ' ');
    if (bersih.length < 20) {
      hasil.push(k);
      continue;
    }
    // Cek juga 3 kata pertama, bukan cuma kalimat identik persis - model kecil kadang mengulang
    // AWAL kalimat yang sama tapi lanjut dengan variasi angka/contoh berbeda (mis. rangkaian
    // "Pecahan senilai itu..." berulang dengan pecahan berbeda tiap kali) - itu tetap gejala
    // pola pengulangan yang sama, bukan penjelasan baru yang berarti.
    const awal = bersih.split(' ').slice(0, 3).join(' ');
    if (terlihat.has(bersih) || awalTerlihat.has(awal)) break;
    terlihat.add(bersih);
    awalTerlihat.add(awal);
    hasil.push(k);
  }
  return hasil.join(' ').trim();
}

async function chatPertanyaanBaru({ pertanyaan, konteks, jenjang, modeSocratic = true }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt({ jenjang, tahap: 'pertanyaan_baru', modeSocratic }) },
    { role: 'user', content: `Konteks materi:\n${konteks}\n\nPertanyaan siswa: ${pertanyaan}` },
  ];
  // Temperature rendah di tahap ini supaya model lebih konsisten patuh pada aturan
  // "jangan bocorkan jawaban akhir" — pada model kecil (2B), temperature lebih tinggi
  // membuat kepatuhan pada instruksi ini jadi tidak konsisten antar percobaan.
  // num_predict jadi batas keras terakhir kalau model kecil terjebak pola pengulangan tanpa henti
  // (terbukti dari pengujian nyata: pertanyaan "apa itu pecahan?" bisa membuat model mengulang
  // "1/2 = 2/4 = 3/6 = ..." puluhan kali sebelum berhenti sendiri) - respons Socratic tahap ini
  // selalu singkat (cuma konteks + tanya balik), jadi batas 400 token lebih dari cukup. CATATAN:
  // repeat_penalty SENGAJA tidak dipakai - dari pengujian nyata pada model kecil ini, menaikkan
  // repeat_penalty (dicoba 1.3) malah membuatnya terjebak mengulang SATU PARAGRAF UTUH secara literal
  // (bukan mengurangi pengulangan), lebih buruk dari perilaku default.
  const jawabanMentah = potongJawabanBerulang(await chat(messages, { temperature: 0.1, numPredict: 400 }));
  // Sensor tanggal cuma relevan untuk mode Socratic (yang MEMANG sengaja menahan jawaban) - di
  // mode langsung, tanggal/angka justru WAJIB muncul karena itu bagian dari penjelasan yang diminta.
  return modeSocratic ? sensorTanggalBocor(jawabanMentah, konteks) : jawabanMentah;
}

async function chatEvaluasiJawaban({ pertanyaanAsli, konteks, jawabanSiswa, jenjang }) {
  // Model kecil (Qwen2.5:1.5b) terbukti dari pengujian sering salah hitung sendiri untuk angka
  // yang cukup besar (mis. perkalian 4 digit), dan tool-calling asli Ollama juga tidak reliabel
  // begitu ada system prompt. Jadi kalkulasi dilakukan deterministik di kode (lihat calculator.js),
  // hasilnya disuntikkan sebagai fakta terverifikasi - model tinggal membandingkan/menjelaskan,
  // bukan menghitung sendiri dari nol.
  const kalkulasi = cariDanHitungEkspresi(pertanyaanAsli);
  const konteksFinal = kalkulasi
    ? `${konteks}\n\n[Hasil kalkulator terverifikasi, PASTI benar - jadikan acuan utama]\n${kalkulasi.ekspresi} = ${kalkulasi.hasil}`
    : konteks;

  const messages = [
    { role: 'system', content: buildSystemPrompt({ jenjang, tahap: 'mengevaluasi_jawaban_siswa' }) },
    {
      role: 'user',
      content:
        `Konteks materi:\n${konteksFinal}\n\n` +
        `Pertanyaan awal siswa: ${pertanyaanAsli}\n\n` +
        `Jawaban percobaan siswa: ${jawabanSiswa}`,
    },
  ];
  return potongJawabanBerulang(await chat(messages, { numPredict: 400 }));
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

  return soal.map(verifikasiJawabanHitungan);
}

// Kalau pertanyaan soal mengandung ekspresi aritmetika yang bisa dihitung pasti (mis. "Berapa
// 47 x 23?"), verifikasi kunci jawaban AI terhadap hasil kalkulator. Kalau salah satu pilihan
// cocok dengan hasil yang benar, jadikan itu jawaban_benar (perbaiki kalau AI salah tandai).
// Kalau tidak ada pilihan yang cocok sama sekali, timpa pilihan yang ditandai AI sebagai benar
// dengan angka yang benar - supaya kunci jawaban tetap akurat walau AI salah hitung.
function angkaDariTeksPilihan(teks) {
  const bersih = String(teks).replace(/[^\d.,\-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
  return parseFloat(bersih);
}

function formatAngkaId(n) {
  return Number.isInteger(n) ? n.toLocaleString('id-ID') : String(n);
}

function verifikasiJawabanHitungan(s) {
  if (!s || !s.pertanyaan || !Array.isArray(s.pilihan)) return s;
  const kalkulasi = cariDanHitungEkspresi(s.pertanyaan);
  if (!kalkulasi) return s;

  const idxCocok = s.pilihan.findIndex((p) => {
    const angka = angkaDariTeksPilihan(p);
    return Number.isFinite(angka) && Math.abs(angka - kalkulasi.hasil) < 0.001;
  });

  if (idxCocok >= 0) {
    return { ...s, jawaban_benar: idxCocok };
  }

  const pilihanBaru = [...s.pilihan];
  const idxTimpa =
    typeof s.jawaban_benar === 'number' && s.jawaban_benar >= 0 && s.jawaban_benar < pilihanBaru.length
      ? s.jawaban_benar
      : 0;
  pilihanBaru[idxTimpa] = formatAngkaId(kalkulasi.hasil);
  return { ...s, pilihan: pilihanBaru, jawaban_benar: idxTimpa };
}

module.exports = {
  PESAN_TIDAK_TAHU,
  AMBANG_RELEVAN,
  cekSmallTalk,
  cekPernyataanMinat,
  butuhModeSocratic,
  retrieveContext,
  chatPertanyaanBaru,
  chatEvaluasiJawaban,
  generateSoal,
};
