# Belajar 3T

Platform belajar fullstack (offline-first PWA) untuk siswa di daerah Terdepan, Terluar, Tertinggal (3T), dengan asisten AI **EduNusa** berbasis RAG + Ollama. Dijalankan sepenuhnya tanpa Docker.

## Daftar Isi

1. [Struktur Proyek](#struktur-proyek)
2. [Prasyarat](#prasyarat-tanpa-docker)
3. [Setup Awal (Sekali Saja)](#setup-awal-sekali-saja)
4. [Menjalankan Aplikasi](#menjalankan-aplikasi)
5. [Membuat Akun Admin Pertama](#membuat-akun-admin-pertama)
6. [Cara Mengoperasikan Aplikasi](#cara-mengoperasikan-aplikasi)
7. [Ringkasan API Backend](#ringkasan-api-backend)
8. [Menguji Mode Offline (PWA)](#menguji-mode-offline-pwa)
9. [Fine-tuning Model EduNusa](#fine-tuning-model-edunusa-opsional)
10. [Troubleshooting](#troubleshooting)
11. [Catatan Keamanan](#catatan-keamanan)

---

## Struktur Proyek

```
belajar-3t/
├── package.json          # root npm workspaces + script "npm run dev"
├── backend/               # Express + MongoDB API
│   ├── server.js
│   ├── routes/            # auth, users, materi, soal, progress, ai
│   ├── models/            # User, Materi, Soal, Progress, AiLog
│   ├── middleware/         # auth.js (JWT)
│   ├── utils/              # response.js (format API konsisten), csv.js
│   └── .env.example
├── frontend/               # React + Vite PWA (Tailwind CSS)
│   ├── src/pages/{Murid,Guru,Admin}/
│   ├── src/components/     # Navbar, StatusKoneksi, AITutor (EduNusa), ProgressBar, MateriCard
│   ├── src/utils/           # api.js, auth.js, localDB.js, offlineCache.js, syncManager.js
│   └── public/               # manifest.json, service-worker.js, icons/
├── ai-service/              # RAG + Ollama + vector store lokal (dipanggil langsung oleh backend)
│   ├── rag.js
│   ├── embeddings.js
│   └── ollama.js
└── edunusa-model/            # Konfigurasi & data fine-tuning model AI Tutor "EduNusa"
    ├── Modelfile
    ├── setup-edunusa.sh
    ├── kurikulum/              # taruh PDF/TXT buku Kemendikbud di sini
    └── training-data/           # identity.jsonl, prepare-dataset.js, finetune-colab.ipynb
```

Catatan penting: `ai-service` **bukan** proses yang berjalan sendiri — ia di-`require` langsung oleh backend (lihat `backend/routes/ai.js`). Jadi yang benar-benar perlu dijalankan cuma **backend** dan **frontend**.

---

## Prasyarat (tanpa Docker)

1. **Node.js 18+**
2. **MongoDB Atlas** — buat cluster gratis di [mongodb.com/atlas](https://mongodb.com/atlas), ambil connection string-nya, dan pastikan IP Access List mengizinkan koneksi kamu (atau `0.0.0.0/0` untuk pengembangan).
3. **Ollama** — install dari [ollama.com](https://ollama.com), lalu siapkan model:

   ```bash
   ollama pull nomic-embed-text
   cd edunusa-model
   ./setup-edunusa.sh
   ```

   `setup-edunusa.sh` otomatis menarik base model `gemma2:2b` dan membangun model chat `edunusa` yang dipakai
   AI Tutor (lihat `edunusa-model/README.md` untuk detail lengkap, termasuk cara memasang hasil fine-tuning sendiri).
   Ollama berjalan sebagai service di `localhost:11434` (`ollama serve` bila perlu dijalankan manual).

Tidak perlu ChromaDB/Docker — `ai-service` memakai vector store file lokal (`ai-service/vector-store.json`, dibuat otomatis) dengan cosine similarity murni JavaScript.

---

## Setup Awal (Sekali Saja)

```bash
cd belajar-3t
cp backend/.env.example backend/.env
```

Buka `backend/.env` dan isi minimal:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/belajar-3t
JWT_SECRET=ganti_dengan_string_acak_yang_panjang
```

Lalu install semua dependency (backend, frontend, ai-service sekaligus, lewat npm workspaces):

```bash
npm install
```

---

## Menjalankan Aplikasi

### Semua sekaligus (direkomendasikan)

```bash
npm run dev
```

Menjalankan backend (`http://localhost:5000`) dan frontend (`http://localhost:5173`, proxy `/api` ke backend) bersamaan di satu terminal.

### Terpisah (opsional, untuk debugging)

```bash
npm run dev -w backend
npm run dev -w frontend
```

### Build untuk produksi

```bash
npm run build -w frontend   # menghasilkan frontend/dist
npm run start -w backend    # menjalankan backend tanpa nodemon (mode produksi)
```

Setelah backend & frontend jalan, buka **http://localhost:5173** di browser.

---

## Membuat Akun Admin Pertama

Demi keamanan, endpoint registrasi publik (`POST /api/auth/register`) **tidak bisa** dipakai untuk membuat akun admin — hanya `murid`/`guru`. Akun admin pertama harus dibuat langsung lewat script (sekali saja), setelahnya admin bisa membuat admin/guru/murid lain lewat halaman **Kelola Pengguna**.

Jalankan dari folder `backend/`:

```bash
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hashed = await bcrypt.hash('GANTI_PASSWORD_INI', 10);
  const user = await User.create({
    nama: 'Nama Admin',
    email: 'admin@contoh.com',
    password: hashed,
    role: 'admin',
  });
  console.log('Akun admin dibuat:', user.email);
  process.exit(0);
});
"
```

Ganti `GANTI_PASSWORD_INI`, `admin@contoh.com`, dan `Nama Admin` sesuai kebutuhan sebelum menjalankan.

---

## Cara Mengoperasikan Aplikasi

### Alur untuk Admin

1. Login di `/login` dengan akun admin.
2. Dashboard admin (`/admin`) menampilkan ringkasan (jumlah murid/guru/admin/materi) dan menu ke semua fitur kelola:
   - **Kelola Pengguna** (`/admin/users`) — tambah/edit/hapus akun murid, guru, admin. Untuk reset password pengguna lain, buka form edit lalu isi field password (kosongkan jika tidak ingin mengubah).
   - **Kelola Materi** (`/guru/materi`) — CRUD materi pelajaran (judul, mapel, jenjang, kelas, konten, file lampiran).
   - **Kelola Soal** (`/guru/soal`) — CRUD soal pilihan ganda per materi.
   - **Progress Murid** (`/guru/murid`) — pantau progres belajar murid per sekolah.
   - **Statistik EduNusa** (`/admin/edunusa`) — jumlah pertanyaan hari ini/minggu ini, rata-rata response time, daftar pertanyaan yang belum terjawab (insight konten yang perlu ditambahkan), dan tombol export log ke CSV.
3. Untuk mengganti password sendiri, klik **Ubah Password** di navbar.

### Alur untuk Guru

1. Login di `/login` dengan akun guru (dibuatkan oleh admin lewat Kelola Pengguna).
2. Dashboard guru (`/guru/dashboard`) menampilkan jumlah murid aktif, rata-rata skor, dan notifikasi murid yang tidak aktif >7 hari.
3. Kelola materi & soal lewat `/guru/materi` dan `/guru/soal`.
4. Pantau progres tiap murid lewat `/guru/murid`.

### Alur untuk Murid

1. Login di `/login` dengan akun murid (dibuatkan oleh admin, atau bisa daftar sendiri lewat endpoint `POST /api/auth/register` bila frontend registrasi disediakan sekolah).
2. Dashboard murid (`/murid/dashboard`) menampilkan statistik belajar (materi selesai, soal dikerjakan, hari belajar) dan daftar mata pelajaran.
3. Buka materi (`/murid/materi/:id`) untuk membaca konten, menyimpannya untuk offline (tombol "Simpan offline"), atau bertanya ke **EduNusa** langsung di halaman tersebut.
4. Klik **Mulai Latihan** untuk mengerjakan soal (`/murid/latihan/:materi_id`) — feedback langsung benar/salah, skor akhir ditampilkan di akhir sesi.
5. Semua progres tersimpan otomatis; jika sedang offline, progres disimpan di perangkat dan otomatis tersinkron begitu koneksi kembali (lihat bagian [Menguji Mode Offline](#menguji-mode-offline-pwa)).

### Lupa Password

Belum ada alur "lupa password" via email. Jika lupa password, hubungi admin/operator sekolah agar direset lewat halaman **Kelola Pengguna**.

---

## Ringkasan API Backend

Semua response memakai format konsisten: `{ success, data, message }`. Endpoint yang butuh login memakai header `Authorization: Bearer <token>`.

| Endpoint | Deskripsi |
|---|---|
| `POST /api/auth/register` | Daftar akun baru (murid/guru saja) |
| `POST /api/auth/login` | Login, dapat JWT token |
| `GET /api/auth/me` | Data akun yang sedang login |
| `PUT /api/auth/password` | Ubah password sendiri (perlu password lama) |
| `GET/POST/PUT/DELETE /api/users` | CRUD pengguna — **admin only** |
| `GET/POST/PUT/DELETE /api/materi` | CRUD materi — baca publik, ubah guru/admin |
| `GET/POST/PUT/DELETE /api/soal`, `POST /api/soal/bulk` | CRUD soal — baca publik, ubah guru/admin |
| `GET/POST /api/progress`, `POST /api/progress/bulk`, `GET /api/progress/murid/:id`, `GET /api/progress/guru/:sekolah` | Progres belajar murid & ringkasan untuk guru |
| `POST /api/ai/tanya` | Tanya ke EduNusa (RAG) |
| `POST /api/ai/generate-soal` | Generate soal otomatis dari topik — guru/admin |
| `GET /api/ai/status` | Health check model EduNusa di Ollama |
| `GET /api/ai/logs/stats`, `GET /api/ai/logs/export` | Statistik & export CSV log EduNusa — admin only |

---

## Menguji Mode Offline (PWA)

1. Jalankan `npm run dev`, buka `http://localhost:5173`, login sebagai murid.
2. Buka DevTools browser → tab **Application** → pastikan Service Worker ter-registrasi.
3. Buka sebuah materi, klik **Simpan offline**, lalu buka juga latihan soalnya (agar soal ikut ter-cache).
4. Di DevTools tab **Network**, centang **Offline** (atau matikan Wi-Fi sungguhan).
5. Kerjakan soal latihan — jawaban tetap tersimpan ke IndexedDB meski tanpa koneksi.
6. Nyalakan kembali koneksi (uncheck Offline / nyalakan Wi-Fi) — indikator status di navbar akan berubah ke **Online**, dan progres yang tertunda otomatis terkirim ke server (`POST /api/progress/bulk`) dengan notifikasi singkat saat sinkronisasi berhasil.

---

## Fine-tuning Model EduNusa (Opsional)

Lihat `edunusa-model/README.md` untuk detail penuh. Ringkasnya:

1. Taruh file PDF/TXT kurikulum di `edunusa-model/kurikulum/`.
2. Jalankan `node edunusa-model/training-data/prepare-dataset.js` untuk menghasilkan `dataset-final.jsonl`.
3. Upload dataset itu ke `edunusa-model/training-data/finetune-colab.ipynb` di Google Colab untuk fine-tuning LoRA + export ke GGUF.
4. Pasang hasil `.gguf` ke `edunusa-model/Modelfile`, lalu `ollama create edunusa -f Modelfile` ulang.

---

## Troubleshooting

- **`MongoDB connection error` saat start backend** — cek `MONGO_URI` di `.env`, dan pastikan IP kamu ada di Access List Atlas.
- **`querySrv ECONNREFUSED` saat connect ke Atlas** — resolver DNS jaringan kamu (router/ISP/sekolah) gagal me-resolve DNS SRV record yang dipakai `mongodb+srv://`. Backend sudah otomatis memaksa pakai DNS publik (1.1.1.1/8.8.8.8) untuk mengatasi ini — kalau masih gagal setelah restart `npm run dev`, coba ganti `DNS_SERVERS` di `.env` dengan resolver lain, atau pakai connection string non-SRV (`mongodb://host1,host2,host3/...`) dari Atlas → Connect → Drivers → "I don't have DNS SRV support".
- **EduNusa menjawab "Maaf, materi ini belum tersedia" terus** — cek model sudah dibuat (`ollama list` harus ada `edunusa`), dan pastikan sudah ada materi yang diunggah (materi otomatis ter-indeks ke vector store saat dibuat/diedit lewat Kelola Materi).
- **`GET /api/ai/status` mengembalikan `model_tidak_ditemukan`** — jalankan `edunusa-model/setup-edunusa.sh` untuk membangun model `edunusa` di Ollama lokal.
- **Port 5000 sudah dipakai** — matikan proses Node lama yang masih jalan sebelum `npm run dev` lagi.
- **Perubahan di frontend tidak muncul di PWA** — service worker meng-cache aset lama; hard refresh (Ctrl+Shift+R) atau unregister service worker lama di DevTools → Application.

---

## Catatan Keamanan

- Ganti `JWT_SECRET` di `.env` dengan string acak yang panjang sebelum ke produksi.
- Registrasi publik (`/api/auth/register`) hanya bisa membuat akun `murid`/`guru`; pembuatan akun `admin` hanya lewat script seed awal atau lewat admin lain di Kelola Pengguna.
- Paket AI Ollama untuk Node.js dipublikasikan di npm dengan nama `ollama` (bukan `ollama-js`); `ai-service/package.json` sudah menggunakan nama paket yang benar.
- Vector store (`ai-service/vector-store.json`) cocok untuk skala kecil-menengah; kalau materi sudah sangat banyak, pertimbangkan MongoDB Atlas Vector Search sebagai pengganti (tetap tanpa server tambahan, karena sudah pakai Atlas).
