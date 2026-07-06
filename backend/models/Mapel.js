const mongoose = require('mongoose');

const mapelSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true, unique: true },
    jenjang: { type: [String], enum: ['SD', 'SMP', 'SMA'], default: ['SD', 'SMP', 'SMA'] },
    icon: { type: String, trim: true, default: 'ti-book' },
    warna: { type: String, enum: ['teal', 'blue', 'amber', 'purple', 'red'], default: 'teal' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Mapel', mapelSchema);
