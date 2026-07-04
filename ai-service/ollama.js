const { Ollama } = require('ollama');

const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' });

const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'gemma2:2b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

async function generateEmbedding(text) {
  const response = await ollama.embeddings({ model: EMBED_MODEL, prompt: text });
  return response.embedding;
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

module.exports = { ollama, generateEmbedding, chat, checkOllamaStatus, CHAT_MODEL, EMBED_MODEL };
