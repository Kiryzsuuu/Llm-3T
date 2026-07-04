# Belajar 3T

Platform belajar fullstack (offline-first PWA) untuk siswa di daerah Terdepan, Terluar, Tertinggal (3T), dengan asisten AI berbasis RAG + Ollama. Dijalankan sepenuhnya tanpa Docker.

## Struktur Proyek

```
belajar-3t/
├── backend/            # Express + MongoDB API
│   ├── server.js
│   ├── routes/         # auth, materi, soal, progress, ai
│   ├── models/         # User, Materi, Soal, Progress
│   ├── middleware/      # auth.js (JWT)
│   └── .env.example
├── frontend/           # React + Vite PWA
│   ├── src/pages/{Murid,Guru,Admin}/
│   ├── src/components/
│   ├── src/utils/       # api.js, offlineCache.js, localDB.js
│   └── public/          # service-worker.js, manifest.json
└── ai-service/          # RAG + Ollama + vector store lokal
    ├── rag.js
    ├── embeddings.js
    └── ollama.js
```

## Prasyarat (tanpa Docker)

1. **MongoDB Atlas** — buat cluster gratis di [mongodb.com/atlas](https://mongodb.com/atlas), ambil connection string-nya.
2. **Ollama** — install dari [ollama.com](https://ollama.com), lalu tarik model yang dipakai:
   ```bash
   ollama pull llama3.1
   ollama pull nomic-embed-text
   ```
   Ollama otomatis berjalan sebagai service di `localhost:11434` (`ollama serve` bila perlu dijalankan manual).
3. **Node.js 18+**

Tidak perlu ChromaDB/Docker — `ai-service` memakai vector store file lokal (`ai-service/vector-store.json`, dibuat otomatis) dengan cosine similarity murni JavaScript.

## Menjalankan Secara Lokal

Catatan: `ai-service` bukan proses yang berjalan sendiri — dia dipanggil langsung sebagai module oleh backend (lihat `backend/routes/ai.js`). Jadi yang benar-benar perlu dijalankan cuma **backend** dan **frontend**.

### Setup sekali di awal

```bash
cd belajar-3t
cp backend/.env.example backend/.env
# isi MONGO_URI di backend/.env dengan connection string Atlas kamu
npm install
```

Perintah `npm install` di root ini otomatis meng-install dependency untuk `backend`, `frontend`, dan `ai-service` sekaligus (pakai npm workspaces).

### Menjalankan semuanya dengan satu perintah

```bash
npm run dev
```

Ini menjalankan backend (`http://localhost:5000`) dan frontend (`http://localhost:5173`, proxy `/api` ke backend) bersamaan di satu terminal.

### Menjalankan terpisah (opsional)

```bash
npm run dev -w backend
npm run dev -w frontend
```

## Fitur Utama

- **Multi-role**: murid, guru, admin — masing-masing dengan dashboard terpisah.
- **Offline-first**: materi, soal, dan progres disimpan di IndexedDB (`idb`) via `localDB.js`, disinkronkan otomatis saat online kembali (`offlineCache.js`) lewat service worker (`service-worker.js`) dan endpoint `POST /api/progress/sync`.
- **Asisten AI (RAG)**: `POST /api/ai/tanya` mengambil konteks materi dari vector store lokal, lalu menjawab menggunakan model chat Ollama.
- **PWA**: `manifest.json` + `service-worker.js` agar aplikasi bisa di-install dan dipakai offline.

## Catatan

- Paket AI Ollama untuk Node.js dipublikasikan di npm dengan nama `ollama` (bukan `ollama-js`); `ai-service/package.json` sudah menggunakan nama paket yang benar.
- Ganti `JWT_SECRET` di `.env` sebelum deploy ke produksi.
- Vector store (`ai-service/vector-store.json`) cocok untuk skala kecil-menengah; kalau materi sudah sangat banyak, pertimbangkan MongoDB Atlas Vector Search sebagai pengganti (tetap tanpa server tambahan, karena sudah pakai Atlas).
