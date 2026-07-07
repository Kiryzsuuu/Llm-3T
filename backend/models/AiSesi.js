const mongoose = require('mongoose');

// Menyimpan state percakapan Socratic EduNusa secara eksplisit di database, bukan mengandalkan
// LLM menebak sedang di tahap mana (lihat EDUNUSA_CATATAN_PERBAIKAN.md bagian 4.2).
// Satu dokumen = satu putaran tanya-jawab: dibuat saat pertanyaan baru masuk (tahap
// 'menunggu_jawaban_siswa'), lalu ditutup ('selesai') setelah siswa mencoba menjawab dan
// EduNusa mengevaluasinya.
const aiSesiSchema = new mongoose.Schema(
  {
    murid_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materi' },
    pertanyaan_asli: { type: String, required: true },
    konteks: { type: String, required: true },
    jenjang: { type: String },
    confidence: { type: Number },
    tahap: {
      type: String,
      enum: ['menunggu_jawaban_siswa', 'selesai'],
      default: 'menunggu_jawaban_siswa',
    },
  },
  { timestamps: true }
);

aiSesiSchema.index({ murid_id: 1, tahap: 1 });

module.exports = mongoose.model('AiSesi', aiSesiSchema);
