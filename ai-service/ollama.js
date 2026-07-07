const { Ollama } = require('ollama');

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

const CHAT_MODEL = process.env.EDUNUSA_MODEL || 'edunusa';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// nomic-embed-text WAJIB diberi prefix instruksi ("search_query: " vs "search_document: ")
// supaya embedding-nya benar-benar diskriminatif. Tanpa prefix ini, similarity antara pertanyaan
// yang relevan dan yang sama sekali tidak relevan bisa hampir sama besar (bahkan terbalik) —
// ini yang menyebabkan retrieval mengambil chunk yang salah / pertanyaan di luar topik lolos
// ambang batas (Bug 3.1 & 3.2 di EDUNUSA_CATATAN_PERBAIKAN.md).
function generateEmbedding(text, tipe = 'document') {
  const prefix = tipe === 'query' ? 'search_query: ' : 'search_document: ';
  return ollama.embeddings({ model: EMBED_MODEL, prompt: `${prefix}${text}` }).then((r) => r.embedding);
}

async function chat(prompt, options = {}) {
  const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
  const response = await ollama.chat({
    model: options.model || CHAT_MODEL,
    messages,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.3,
      ...options.modelOptions,
    },
  });
  return response.message.content;
}

async function checkOllamaStatus() {
  try {
    const { models } = await ollama.list();
    const namaModel = (models || []).map((m) => m.name);
    return {
      online: true,
      models: namaModel,
      chatModelTersedia: namaModel.some((m) => m.startsWith(CHAT_MODEL.split(':')[0])),
      embedModelTersedia: namaModel.some((m) => m.startsWith(EMBED_MODEL.split(':')[0])),
    };
  } catch (err) {
    return { online: false, models: [], error: err.message };
  }
}

async function getEduNusaStatus() {
  try {
    const { models } = await ollama.list();
    const info = (models || []).find(
      (m) => m.name === CHAT_MODEL || m.name.startsWith(`${CHAT_MODEL}:`)
    );

    if (!info) {
      return { model: CHAT_MODEL, version: null, status: 'model_tidak_ditemukan' };
    }

    return {
      model: CHAT_MODEL,
      version: info.digest ? info.digest.slice(0, 12) : null,
      status: 'online',
      parameter_size: info.details?.parameter_size || null,
      quantization_level: info.details?.quantization_level || null,
      modified_at: info.modified_at || null,
    };
  } catch (err) {
    return { model: CHAT_MODEL, version: null, status: 'offline', error: err.message };
  }
}

module.exports = { ollama, generateEmbedding, chat, checkOllamaStatus, getEduNusaStatus, CHAT_MODEL, EMBED_MODEL };
