const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// MongoDB portable (ZIP, tanpa installer/admin) diekstrak ke mongodb-portable/, dan data
// disimpan di data/mongodb/ — keduanya di dalam folder proyek ini sendiri, bukan lokasi sistem.
// Tujuannya: seluruh aplikasi (kode + data) tetap dalam satu folder yang gampang di-backup atau
// dipindah ke PC lain (mis. PC yang dibawa pameran), tanpa bergantung pada instalasi service Windows.
const ROOT = path.join(__dirname, '..');
const MONGOD = path.join(ROOT, 'mongodb-portable', 'bin', 'mongod.exe');
const DB_PATH = path.join(ROOT, 'data', 'mongodb');
const PORT = process.env.MONGO_PORT || '27017';

if (!fs.existsSync(MONGOD)) {
  console.error(
    `mongod.exe tidak ditemukan di ${MONGOD}\n` +
    'Ekstrak dulu MongoDB portable ZIP ke folder "mongodb-portable/" di root proyek ' +
    '(lihat README bagian "Deployment untuk Sekolah 3T (Tanpa Internet)").'
  );
  process.exit(1);
}

fs.mkdirSync(DB_PATH, { recursive: true });

const mongod = spawn(MONGOD, ['--dbpath', DB_PATH, '--port', PORT, '--bind_ip', '127.0.0.1'], {
  stdio: 'inherit',
});

mongod.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => mongod.kill('SIGINT'));
process.on('SIGTERM', () => mongod.kill('SIGTERM'));
