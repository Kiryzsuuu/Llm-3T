const fs = require('fs');
const path = require('path');
const { generateEmbedding } = require('./ollama');

// Vector store lokal berbasis file JSON (tanpa server/Docker terpisah).
const STORE_PATH = process.env.VECTOR_STORE_PATH || path.join(__dirname, 'vector-store.json');

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return [];
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
}

function saveStore(items) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(items));
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Baris yang mengawali poin/butir terpisah (mis. "1. ...", "Sila ke-2", "Pasal 3", "- ...", "a) ...")
// WAJIB dipisah jadi paragraf sendiri, meski tidak ada baris kosong di antaranya di teks sumber.
// Tanpa ini, daftar seperti "5 sila Pancasila" bisa tergabung jadi satu chunk besar, sehingga saat
// ditanya "sila ke-2" model bisa salah ambil/menjawab sila lain dari chunk campuran yang sama.
const POLA_AWAL_POIN = /^(\d+[.)]\s|[a-z][.)]\s|[-•*]\s|sila\s+ke[- ]?\d|pasal\s+\d|bab\s+[ivxlcdm\d]+\b)/i;

function pisahkanPoinList(teks) {
  const baris = teks.split('\n');
  const hasil = [];
  let current = [];

  for (const b of baris) {
    if (POLA_AWAL_POIN.test(b.trim()) && current.length > 0) {
      hasil.push(current.join('\n'));
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length > 0) hasil.push(current.join('\n'));

  return hasil.join('\n\n');
}

function chunkText(text, chunkSize = 500) {
  const bersih = pisahkanPoinList(text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim());
  const paragraf = bersih.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks = [];
  let current = '';
  let currentAdalahPoin = false;

  for (const p of paragraf) {
    const pAdalahPoin = POLA_AWAL_POIN.test(p);

    // Dua poin/butir berbeda (mis. sila 1 dan sila 2) TIDAK BOLEH digabung dalam satu chunk,
    // meski ukurannya kecil — supaya retrieval tidak mengambil chunk campuran beberapa poin sekaligus.
    const bolehGabung = !(currentAdalahPoin && pAdalahPoin) && (current + '\n\n' + p).length <= chunkSize;

    if (bolehGabung) {
      current = current ? `${current}\n\n${p}` : p;
      currentAdalahPoin = currentAdalahPoin || pAdalahPoin;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (p.length <= chunkSize) {
      current = p;
      currentAdalahPoin = pAdalahPoin;
    } else {
      // paragraf sendiri lebih panjang dari chunkSize, potong per kata
      const kata = p.split(' ');
      let potongan = '';
      for (const k of kata) {
        if ((potongan + ' ' + k).trim().length > chunkSize) {
          chunks.push(potongan.trim());
          potongan = k;
        } else {
          potongan = potongan ? `${potongan} ${k}` : k;
        }
      }
      if (potongan) current = potongan.trim();
      currentAdalahPoin = pAdalahPoin;
    }
  }

  if (current) chunks.push(current);

  return chunks.filter((c) => c.length > 0);
}

async function extractTextFromFile(filePath) {
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

  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  throw new Error(`Format file tidak didukung: ${ext}`);
}

async function prosesFile(filePath, metadata = {}) {
  const teks = await extractTextFromFile(filePath);
  const chunks = chunkText(teks, metadata.chunkSize || 500);

  const items = loadStore();
  const disimpan = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateEmbedding(chunk, 'document');
    const id = `${metadata.materi_id || path.basename(filePath)}-${i}`;

    const item = {
      id,
      text: chunk,
      embedding,
      metadata: { ...metadata, chunk_index: i, source_file: path.basename(filePath) },
    };

    const idx = items.findIndex((it) => it.id === id);
    if (idx >= 0) items[idx] = item;
    else items.push(item);

    disimpan.push(id);
  }

  saveStore(items);

  return { totalChunks: chunks.length, ids: disimpan };
}

async function addDocument({ id, text, metadata }) {
  const embedding = await generateEmbedding(text, 'document');
  const items = loadStore().filter((item) => item.id !== String(id));
  items.push({ id: String(id), text, embedding, metadata: metadata || {} });
  saveStore(items);
}

function hapusDocumentByMateriId(materiId) {
  const items = loadStore().filter((item) => item.metadata?.materi_id !== String(materiId));
  saveStore(items);
}

async function queryDocuments(text, nResults = 4, where) {
  const embedding = await generateEmbedding(text, 'query');
  let items = loadStore();

  if (where) {
    items = items.filter((item) =>
      Object.entries(where).every(([key, value]) => item.metadata[key] === value)
    );
  }

  const scored = items
    .map((item) => ({ ...item, score: cosineSimilarity(embedding, item.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, nResults);

  return {
    documents: [scored.map((item) => item.text)],
    metadatas: [scored.map((item) => item.metadata)],
    ids: [scored.map((item) => item.id)],
    distances: [scored.map((item) => 1 - item.score)],
  };
}

function getCollectionStats() {
  const items = loadStore();
  const sumberUnik = new Set(items.map((item) => item.metadata.source_file || item.metadata.materi_id));
  const materiUnik = new Set(items.map((item) => item.metadata.materi_id).filter(Boolean));

  return {
    totalChunks: items.length,
    totalSumber: sumberUnik.size,
    totalMateri: materiUnik.size,
  };
}

module.exports = {
  chunkText,
  prosesFile,
  extractTextFromFile,
  getCollectionStats,
  addDocument,
  hapusDocumentByMateriId,
  queryDocuments,
};
