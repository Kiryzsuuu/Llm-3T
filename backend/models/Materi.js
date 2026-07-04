const mongoose = require('mongoose');

const materiSchema = new mongoose.Schema(
  {
    judul: { type: String, required: true, trim: true },
    mapel: { type: String, required: true, trim: true },
    jenjang: { type: String, enum: ['SD', 'SMP', 'SMA'], required: true },
    kelas: { type: String, required: true },
    bab: { type: String, trim: true },
    konten: { type: String, required: true },
    file_url: { type: String, trim: true },
    dibuat_oleh: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Materi', materiSchema);
