const mongoose = require('mongoose');

const aiLogSchema = new mongoose.Schema({
  murid_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pertanyaan: { type: String, required: true },
  jawaban: { type: String, required: true },
  mapel: { type: String, trim: true },
  response_time: { type: Number, required: true }, // dalam milidetik
  timestamp: { type: Date, default: Date.now },
});

aiLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AiLog', aiLogSchema, 'ai_logs');
