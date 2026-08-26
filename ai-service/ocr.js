const path = require('path');
const { createWorker } = require('tesseract.js');

// Data bahasa OCR (ind + eng) disimpan lokal di ocr-data/ (lihat README/start.ps1 untuk cara
// mengunduhnya sekali di awal) supaya OCR jalan sepenuhnya offline - tidak fetch apapun dari
// CDN saat runtime, cocok untuk deployment tanpa internet di sekolah/pameran 3T.
const LANG_PATH = path.join(__dirname, '..', 'ocr-data');

async function extractTextFromImage(filePath) {
  const worker = await createWorker('ind+eng', 1, {
    langPath: LANG_PATH,
    cachePath: LANG_PATH,
    gzip: true,
  });

  try {
    const { data } = await worker.recognize(filePath);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

module.exports = { extractTextFromImage };
