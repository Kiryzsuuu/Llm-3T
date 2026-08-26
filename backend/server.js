require('dotenv').config();
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Sebagian jaringan (router/ISP/sekolah) gagal me-resolve DNS SRV record yang dipakai
// mongodb+srv://, meski koneksi internet normal. Memaksa pakai resolver DNS publik di sini
// memperbaiki error "querySrv ECONNREFUSED" tanpa perlu mengubah setting jaringan sistem.
// Bisa dimatikan dengan DNS_OVERRIDE=false di .env bila resolver default sudah bekerja baik.
if (process.env.DNS_OVERRIDE !== 'false') {
  const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map((s) => s.trim());
  dns.setServers(dnsServers);
}

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const mapelRoutes = require('./routes/mapel');
const bankMateriRoutes = require('./routes/bank-materi');
const materiRoutes = require('./routes/materi');
const soalRoutes = require('./routes/soal');
const progressRoutes = require('./routes/progress');
const aiRoutes = require('./routes/ai');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Folder ini tidak ikut ter-commit ke git (isinya file upload guru/admin, spesifik per instalasi),
// jadi harus dibuat otomatis saat backend start - tanpa ini, upload materi (multer) gagal dengan
// ENOENT di instalasi baru manapun.
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' }, message: 'OK' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/mapel', mapelRoutes);
app.use('/api/bank-materi', bankMateriRoutes);
app.use('/api/materi', materiRoutes);
app.use('/api/soal', soalRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/ai', aiRoutes);

// Deployment sekolah 3T: satu proses backend melayani API sekaligus build frontend (frontend/dist),
// jadi cukup 1 server & 1 port yang diakses semua device siswa lewat IP LAN — tanpa proses frontend
// terpisah dan tanpa CORS lintas origin. Aktif otomatis kalau frontend sudah di-build; kalau belum
// (mis. saat dev, pakai `npm run dev` yang menjalankan Vite dev server terpisah), bagian ini dilewati.
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ success: false, data: null, message: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, data: null, message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edunusa';

// Retry connect: saat `npm run dev`/`npm run deploy` menjalankan mongod portable (scripts/start-mongodb.js)
// bersamaan dengan backend, mongod butuh beberapa detik untuk siap menerima koneksi — tanpa retry,
// backend akan langsung exit karena mencoba connect sebelum mongod selesai start.
async function connectWithRetry(uri, retries = 10, delayMs = 1500) {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(uri);
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`MongoDB belum siap, mencoba lagi (${i}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

connectWithRetry(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
