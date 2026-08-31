// Kalkulator aman untuk mendukung mata pelajaran Matematika. TIDAK memakai eval()/Function()
// (risiko keamanan), tapi parser recursive-descent sendiri yang cuma mengenali angka dan operator
// aritmetika dasar - cocok untuk cakupan Matematika SD (kelas 1-6): tambah, kurang, kali, bagi,
// pangkat, dan tanda kurung.
//
// LATAR BELAKANG: model kecil (Qwen2.5:1.5b) terbukti dari pengujian sering salah hitung perkalian/
// pembagian angka besar (mis. 4738 x 2913 dijawab salah total), dan tool-calling asli Ollama juga
// terbukti tidak reliabel begitu ada system prompt (yang selalu dipakai aplikasi ini). Jadi
// pendekatannya dibalik: kode yang menghitung dengan pasti benar, hasilnya disuntikkan ke prompt
// sebagai fakta terverifikasi - AI tinggal menjelaskan/membandingkan, bukan menghitung sendiri.

function tokenisasi(ekspresi) {
  const tokens = [];
  const re = /\s*(\d+(?:[.,]\d+)?|[+\-*x×÷/^()])\s*/g;
  let sisa = ekspresi;
  let match;
  let posisi = 0;
  while (posisi < sisa.length) {
    re.lastIndex = posisi;
    match = re.exec(sisa);
    if (!match || match.index !== posisi) {
      throw new Error(`Karakter tidak dikenali pada: "${sisa.slice(posisi, posisi + 10)}"`);
    }
    let token = match[1];
    if (/^\d/.test(token)) token = parseFloat(token.replace(',', '.'));
    else if (token === 'x' || token === '×') token = '*';
    else if (token === '÷') token = '/';
    tokens.push(token);
    posisi = re.lastIndex;
  }
  return tokens;
}

// Grammar: expr := term (('+' | '-') term)*
//          term := pow (('*' | '/') pow)*
//          pow  := unary ('^' unary)*
//          unary := '-' unary | primary
//          primary := NUMBER | '(' expr ')'
function buatParser(tokens) {
  let i = 0;
  const lihat = () => tokens[i];
  const ambil = () => tokens[i++];

  function primary() {
    const t = lihat();
    if (typeof t === 'number') return ambil();
    if (t === '(') {
      ambil();
      const nilai = expr();
      if (lihat() !== ')') throw new Error('Tanda kurung tidak seimbang');
      ambil();
      return nilai;
    }
    throw new Error(`Ekspresi tidak valid di dekat: ${JSON.stringify(t)}`);
  }

  function unary() {
    if (lihat() === '-') {
      ambil();
      return -unary();
    }
    return primary();
  }

  function pow() {
    let nilai = unary();
    while (lihat() === '^') {
      ambil();
      nilai = Math.pow(nilai, unary());
    }
    return nilai;
  }

  function term() {
    let nilai = pow();
    while (lihat() === '*' || lihat() === '/') {
      const op = ambil();
      const kanan = pow();
      if (op === '/') {
        if (kanan === 0) throw new Error('Tidak bisa membagi dengan nol');
        nilai = nilai / kanan;
      } else {
        nilai = nilai * kanan;
      }
    }
    return nilai;
  }

  function expr() {
    let nilai = term();
    while (lihat() === '+' || lihat() === '-') {
      const op = ambil();
      nilai = op === '+' ? nilai + term() : nilai - term();
    }
    return nilai;
  }

  return { expr, selesai: () => i >= tokens.length };
}

// Hitung ekspresi matematika teks (mis. "47 * 23", "(12 + 8) x 3"). Melempar Error kalau ekspresi
// tidak valid - sengaja TIDAK mengembalikan NaN diam-diam, supaya pemanggil tahu kalau gagal parse.
function hitung(ekspresi) {
  const tokens = tokenisasi(String(ekspresi));
  if (tokens.length === 0) throw new Error('Ekspresi kosong');
  const parser = buatParser(tokens);
  const hasil = parser.expr();
  if (!parser.selesai()) throw new Error('Ada token tersisa yang tidak terpakai di ekspresi');
  if (!Number.isFinite(hasil)) throw new Error('Hasil perhitungan tidak valid');
  return hasil;
}

// Kata operator umum Bahasa Indonesia -> simbol, supaya ekspresi dari soal cerita sederhana
// (mis. "24 dibagi 6", "15 dikali 3") ikut terdeteksi, bukan cuma yang pakai simbol +-*/.
const KATA_OPERATOR = [
  [/\bditambah(kan)?\b/gi, '+'],
  [/\bdikurang(i|kan)?\b/gi, '-'],
  [/\bdikali(kan)?\b/gi, '*'],
  [/\bdibagi(kan)?\b/gi, '/'],
  [/\btambah\b/gi, '+'],
  [/\bkurang\b/gi, '-'],
  [/\bkali\b/gi, '*'],
  [/\bbagi\b/gi, '/'],
];

// Cari ekspresi aritmetika sederhana di dalam teks bebas (pertanyaan/soal) dan kembalikan hasilnya
// kalau ketemu persis satu ekspresi yang valid. Sengaja konservatif (return null kalau ragu) -
// lebih baik tidak menyuntikkan apa-apa daripada menyuntikkan angka yang salah tangkap dari teks.
function cariDanHitungEkspresi(teks) {
  let bersih = String(teks || '').toLowerCase();
  for (const [pola, simbol] of KATA_OPERATOR) {
    bersih = bersih.replace(pola, ` ${simbol} `);
  }

  const polaEkspresi = /-?\d+(?:[.,]\d+)?(?:\s*[+\-*x×÷/^]\s*-?\d+(?:[.,]\d+)?)+/g;
  const kandidat = bersih.match(polaEkspresi);
  if (!kandidat || kandidat.length === 0) return null;

  // Ambil kandidat terpanjang (biasanya yang paling relevan, bukan pecahan angka lain di teks).
  const ekspresi = kandidat.sort((a, b) => b.length - a.length)[0];
  try {
    const hasil = hitung(ekspresi);
    return { ekspresi: ekspresi.trim(), hasil };
  } catch (err) {
    return null;
  }
}

module.exports = { hitung, cariDanHitungEkspresi };
