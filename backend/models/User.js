const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    nama: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['murid', 'guru', 'admin'], default: 'murid' },
    sekolah: { type: String, trim: true },
    kelas: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
