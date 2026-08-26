# EduNusa

EduNusa adalah model AI Tutor resmi platform **EduNusa** — sebuah kustomisasi dari model bahasa lokal (saat ini
`gemma2:2b` via Ollama) yang diberi identitas, batasan cakupan materi, dan gaya bahasa khusus agar cocok dipakai
sebagai asisten belajar untuk siswa SD/SMP/SMA di daerah 3T (Terdepan, Terluar, Tertinggal).

EduNusa dirancang untuk:
- Hanya menjawab pertanyaan seputar kurikulum Kemendikbud (SD, SMP, SMA).
- Menjawab dalam Bahasa Indonesia yang mudah dipahami, disesuaikan dengan jenjang murid.
- Menolak dengan sopan ("Maaf, materi ini belum tersedia di EduNusa.") jika pertanyaan di luar kurikulum.
- Memperkenalkan diri sebagai EduNusa buatan tim EduNusa, bukan sebagai model dasar aslinya.
- Menerapkan alur **Socratic** (beri konteks tanpa membocorkan jawaban → tanya balik → evaluasi
  jawaban siswa), bukan tanya-langsung-dijawab.

Model ini dipakai oleh `ai-service/` (lihat `ollama.js` dan `rag.js`) sebagai model chat untuk fitur AI Tutor dan
generate soal otomatis.

## PENTING: Di mana mengubah perilaku EduNusa

Ada **dua** file yang sama-sama berisi "instruksi" untuk EduNusa, tapi cuma satu yang benar-benar
dipakai aplikasi web — jangan tertukar:

| File | Dipakai kapan | Isi |
|---|---|---|
| `system-prompt.js` | **Aplikasi web** (setiap request lewat `POST /api/ai/tanya`) | Aturan sumber/anti-halusinasi, gaya bahasa per jenjang, dan **seluruh logika alur Socratic** |
| `Modelfile` (bagian `SYSTEM`) | Hanya kalau model dipanggil langsung lewat `ollama run edunusa "..."` di terminal | Identitas dasar saja (nama, pembuat, cakupan materi) — **tidak** ada aturan Socratic |

Backend selalu mengirim system prompt dari `system-prompt.js` di setiap request chat, dan itu
menimpa SYSTEM bawaan Modelfile. Jadi: **untuk mengubah cara EduNusa menjelaskan materi atau
menerapkan alur Socratic-nya, edit `system-prompt.js` — itu satu-satunya tempat yang perlu
disentuh untuk update perilaku ke depannya.** Setelah diedit, tidak perlu `ollama create` ulang
(itu cuma perlu kalau Modelfile yang diubah) — backend langsung memakai isi terbaru saat restart.

## Isi Folder

```
edunusa-model/
├── Modelfile           # identitas dasar untuk `ollama run edunusa` manual (lihat tabel di atas)
├── system-prompt.js     # SATU-SATUNYA sumber perilaku EduNusa di aplikasi (edit di sini)
├── setup-edunusa.sh     # script otomatis untuk build & test model EduNusa
└── README.md            # dokumentasi ini
```

## Cara Setup dari Nol

1. Pastikan [Ollama](https://ollama.com) sudah terinstall di komputer kamu.
2. Jalankan script setup dari folder ini:

   ```bash
   cd edunusa-model
   ./setup-edunusa.sh
   ```

   Script ini akan otomatis:
   - Mengecek apakah Ollama sudah terinstall (memberi instruksi install bila belum).
   - Menarik (`pull`) base model `gemma2:2b` bila belum ada di komputer kamu.
   - Membuat model `edunusa` dari `Modelfile` (`ollama create edunusa -f Modelfile`).
   - Menguji model dengan pertanyaan "Siapa kamu?".
   - Menampilkan pesan sukses jika EduNusa siap dipakai.

3. Setelah selesai, model bisa langsung dipanggil dengan nama `edunusa`:

   ```bash
   ollama run edunusa "Jelaskan perkalian pecahan untuk anak SMP"
   ```

4. Pastikan `backend/.env` memakai nama model ini (lihat variabel `EDUNUSA_MODEL`, default-nya sudah `edunusa`).

## Cara Update Model ke Versi Baru

Jika kamu mengubah isi `Modelfile` (misalnya memperbaiki SYSTEM prompt atau parameter), build ulang modelnya dengan
perintah yang sama — Ollama akan menimpa versi lama secara otomatis:

```bash
ollama create edunusa -f Modelfile
```

Untuk melihat riwayat model yang sudah dibuat:

```bash
ollama list
```

Untuk menghapus model lama sebelum membuat ulang dari awal (opsional, biasanya tidak perlu):

```bash
ollama rm edunusa
ollama create edunusa -f Modelfile
```

## Cara Ganti Base Weights dengan Hasil Fine-Tuning (.gguf)

Saat ini `Modelfile` memakai base model `gemma2:2b` bawaan Ollama. Setelah proses fine-tuning selesai dan
menghasilkan file bobot dalam format `.gguf`, ikuti langkah berikut:

1. Salin file hasil fine-tuning (misalnya `edunusa-finetuned.gguf`) ke folder `edunusa-model/`.

2. Ubah baris pertama `Modelfile` dari:

   ```
   FROM gemma2:2b
   ```

   menjadi path ke file `.gguf` tersebut:

   ```
   FROM ./edunusa-finetuned.gguf
   ```

   (SYSTEM prompt dan PARAMETER di bawahnya tidak perlu diubah — tetap dipakai sebagai lapisan identitas dan
   pembatas di atas bobot hasil fine-tuning.)

3. Build ulang model:

   ```bash
   ollama create edunusa -f Modelfile
   ```

4. Uji ulang seperti biasa:

   ```bash
   ollama run edunusa "Siapa kamu?"
   ```

5. Tidak ada perubahan kode yang diperlukan di `ai-service/` atau `backend/` — karena nama model yang dipanggil
   tetap `edunusa` (diatur lewat environment variable `EDUNUSA_MODEL`), aplikasi otomatis memakai versi model yang
   baru begitu langkah di atas selesai.

## Catatan

- SYSTEM prompt di `Modelfile` adalah lapisan pembatas utama agar EduNusa tetap pada identitas dan cakupan
  materinya — ini tetap berlaku baik memakai base model bawaan maupun hasil fine-tuning sendiri.
- `PARAMETER temperature 0.3` dipakai agar jawaban lebih konsisten dan tidak terlalu kreatif/berhalusinasi,
  cocok untuk konteks edukasi.
- `PARAMETER num_predict 500` membatasi panjang maksimum jawaban agar tetap ringkas dan tidak membebani perangkat
  dengan sumber daya terbatas.
