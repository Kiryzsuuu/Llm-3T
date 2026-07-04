const mongoose = require('mongoose');

const soalSchema = new mongoose.Schema(
  {
    materi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materi', required: true },
    pertanyaan: { type: String, required: true },
    pilihan: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 4,
        message: 'Pilihan harus berjumlah 4',
      },
    },
    jawaban_benar: { type: Number, required: true, min: 0, max: 3 },
    penjelasan: { type: String, trim: true },
    tingkat_kesulitan: { type: String, enum: ['mudah', 'sedang', 'sulit'], default: 'sedang' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Soal', soalSchema);
