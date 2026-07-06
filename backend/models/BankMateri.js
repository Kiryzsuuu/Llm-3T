const mongoose = require('mongoose');

// Bank Materi adalah "perpustakaan" master materi yang bisa disalin (bukan di-link)
// ke Kelola Materi ketika guru membuat materi baru untuk kelas tertentu.
// Kategorinya memakai mata pelajaran (Mapel) yang sama seperti di Kelola Materi.
const bankMateriSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true, trim: true },
    mapel: { type: String, required: true, trim: true },
    jenjang: { type: String, enum: ['SD', 'SMP', 'SMA'], required: true },
    bab: { type: String, trim: true },
    konten: { type: String, required: true },
    file_url: { type: String, trim: true },
    dibuat_oleh: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankMateri', bankMateriSchema);
