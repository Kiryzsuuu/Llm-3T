const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    murid_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materi', required: true },
    soal_dikerjakan: { type: Number, default: 0 },
    soal_benar: { type: Number, default: 0 },
    status: { type: String, enum: ['belum_mulai', 'sedang_belajar', 'selesai'], default: 'belum_mulai' },
    last_accessed: { type: Date, default: Date.now },
    synced: { type: Boolean, default: true },
  },
  { timestamps: true }
);

progressSchema.index({ murid_id: 1, materi_id: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);
