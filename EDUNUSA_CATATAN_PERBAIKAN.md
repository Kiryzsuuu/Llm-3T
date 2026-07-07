# EduNusa — Catatan Teknis untuk Perbaikan (Baca Sebelum Coding)

> **Tujuan dokumen ini:** memberi konteks lengkap ke Claude Code tentang kondisi
> EduNusa sekarang, target yang diinginkan, dan **akar masalah** di baliknya.
> Baca seluruhnya sebelum menyentuh kode. Urutan pengerjaan ada di bagian akhir.

---

## 0. Ringkasan Satu Paragraf

EduNusa adalah AI tutor untuk siswa SD/SMP/SMA daerah 3T, dibangun di atas model
open-source (Gemma 2B) yang dijalankan lewat Ollama. Saat ini EduNusa sudah bisa
menjawab pertanyaan dan punya identitas sendiri, TAPI ada dua masalah utama:
(1) **jawaban kadang salah materi** karena grounding ke buku sumber masih lemah,
dan (2) **pola percakapan masih tanya→jawab langsung**, belum menerapkan alur
Socratic yang jadi ciri khas EduNusa. Dokumen ini menjelaskan cara memperbaikinya.

---

## 1. Prinsip yang Wajib Dipahami Dulu (Akar dari Semua Masalah)

Ada satu kesalahpahaman yang harus diluruskan sebelum coding, karena menentukan
seluruh arah perbaikan:

### RAG vs Fine-tuning — jangan tertukar

| Aspek | RAG | Fine-tuning |
|-------|-----|-------------|
| Untuk apa | **ISI / FAKTA materi** (lambang sila, tanggal, definisi) | **GAYA & IDENTITAS** (nada Socratic, "aku EduNusa") |
| Analogi | Murid diberi buku + boleh buka saat ujian | Murid disuruh menghafal seluruh buku |
| Kalau materi ganti | Tinggal ganti isi database | Harus latih ulang dari awal |
| Biaya | Murah, cepat | Mahal, butuh GPU |
| Status di proyek ini | **Prioritas sekarang** | Nanti, setelah prototype terbukti |

**Konsekuensi penting:**
Memasukkan isi buku pelajaran ke EduNusa adalah tugas **RAG**, BUKAN fine-tuning.
Bug "jawaban salah materi" (lihat 3.1) terjadi karena RAG lemah — bukan karena
fine-tuning kurang. Untuk fase sekarang: **RAG dulu, fine-tuning ditunda.**

> Catatan soal Ollama: Ollama bukan model — dia hanya runtime (mesin pemutar).
> Yang menjadi "EduNusa" adalah model-nya (Gemma 2B), bukan Ollama-nya.

---

## 2. Perbandingan: Kondisi Sekarang vs Target

### 2.1 Grounding / Sumber Jawaban

| | Sekarang | Target |
|---|----------|--------|
| Sumber jawaban | Model menjawab dari "ingatan" internal, retrieval lemah/tidak konsisten | Setiap jawaban ditarik dari chunk buku yang relevan lewat RAG |
| Akurasi materi | Kadang salah (mis. ditanya sila ke-2 menjawab sila ke-1) | Jawaban sesuai isi buku, terverifikasi |
| Jika materi tak ada | Kadang mengarang (hallucination) | Jujur bilang "materi belum tersedia" |

### 2.2 Pola Percakapan

| | Sekarang | Target (Socratic) |
|---|----------|-------------------|
| Alur | Anak tanya → langsung dijawab | Anak tanya → EduNusa beri konteks → tanya balik → evaluasi jawaban anak → baru beri jawaban final/penguatan |
| Peran anak | Pasif (menerima jawaban) | Aktif (diajak berpikir dulu) |
| Kapan jawaban final muncul | Di respons pertama | Hanya setelah anak mencoba menjawab |

### 2.3 Manajemen State

| | Sekarang | Target |
|---|----------|--------|
| Cara tahu posisi percakapan | Mengandalkan LLM menebak dari histori | Disimpan eksplisit per sesi di MongoDB (mis. `tahap: "menunggu_jawaban_siswa"`) |
| Keandalan | Rapuh, mudah salah tahap | Deterministik, aplikasi yang mengontrol alur |

### 2.4 Confidence Score

| | Sekarang | Target |
|---|----------|--------|
| Asal angka | Belum jelas — mungkin dekoratif | Dihitung dari similarity score retrieval RAG |
| Risiko | Jawaban salah tapi terlihat "yakin" → menyesatkan | Angka merepresentasikan kecocokan nyata dengan sumber |

---

## 3. Daftar Masalah (Bug) yang Harus Diperbaiki

### 3.1 BUG — Jawaban salah materi (hallucination)
- **Gejala:** ditanya "contoh pengamalan sila ke-2", EduNusa menjelaskan sila ke-1.
- **Akar masalah:** retrieval RAG tidak mengambil chunk yang benar, atau model
  menjawab tanpa benar-benar membaca chunk. Grounding lemah.
- **Perbaikan:** perkuat pipeline RAG (lihat 5.1). Pastikan jawaban HANYA disusun
  dari chunk yang di-retrieve, dan chunk tersebut memang relevan.

### 3.2 BUG — Confidence score belum terverifikasi
- **Gejala:** muncul angka (71%, 73%, dst.) yang belum jelas dasarnya.
- **Akar masalah:** kemungkinan angka tidak terhubung ke similarity retrieval.
- **Perbaikan:** hitung confidence dari skor similarity chunk teratas saat
  retrieval. Kalau similarity rendah → confidence rendah → pertimbangkan jawab
  "materi belum tersedia".

---

## 4. Daftar Pengembangan (Improvement) yang Belum Ada

### 4.1 Alur Socratic
Pola tanya→jelaskan→tanya balik→evaluasi. Belum diterapkan. Detail di bagian 6.

### 4.2 State/flag tracking per sesi
Alur Socratic butuh aplikasi tahu anak sedang di tahap mana. Simpan di MongoDB,
jangan andalkan LLM menebak.

### 4.3 System prompt dirombak
System prompt sekarang kemungkinan hanya "jawab sesuai buku". Perlu ditambah
aturan eksplisit alur Socratic + larangan bocor jawaban di Tahap 1.

### 4.4 Grounding RAG diperkuat
Sama dengan perbaikan Bug 3.1 — retrieval dulu, baru menyusun jawaban.

---

## 5. Perhatian Khusus: Jebakan "Bocor Jawaban di Tahap 1"

Ini interaksi berbahaya antara Bug 3.1 dan fitur Socratic yang WAJIB diperhatikan:

Di Tahap 1, EduNusa memberi konteks lalu bertanya balik. Tapi konteks tidak boleh
membocorkan jawaban. Contoh SALAH:

> Anak: "Apa lambang sila ke-3?"
> EduNusa: "Sila ke-3 adalah Persatuan Indonesia, dilambangkan pohon beringin.
>           Nah, menurutmu apa lambangnya?"  ← KONYOL, jawaban sudah disebut

Contoh BENAR:

> Anak: "Apa lambang sila ke-3?"
> EduNusa: "Sila ke-3 berbunyi 'Persatuan Indonesia'. Lambang tiap sila biasanya
>           punya makna yang berhubungan dengan bunyinya — sesuatu yang kuat,
>           berakar, tempat berteduh bersama. Kira-kira, lambang apa yang cocok?"

Aturan untuk system prompt: **di Tahap 1, beri petunjuk/konteks di sekitar topik
tanpa menyebut jawaban akhirnya.** Bagian ini butuh banyak testing.

---

## 6. Draf System Prompt Socratic (untuk diintegrasikan dengan state)

```
Kamu adalah EduNusa, asisten belajar AI untuk siswa SD, SMP, dan SMA
di daerah 3T, sesuai kurikulum Kemendikbud.

ATURAN SUMBER:
- Jawaban HANYA boleh bersumber dari materi buku yang tersedia di sistem
  (hasil retrieval RAG). Jika materi tidak ditemukan, katakan jujur bahwa
  kamu belum punya materinya. JANGAN mengarang.

ATURAN ALUR (dikendalikan oleh field "tahap" dari aplikasi):

- Jika tahap = "pertanyaan_baru":
  * Beri penjelasan/konteks singkat yang relevan, diambil dari materi buku.
  * JANGAN sebut jawaban akhirnya. Jangan bocorkan.
  * Tutup dengan pertanyaan balik yang mengajak anak berpikir,
    mis. "Dari penjelasan ini, menurutmu jawabannya apa?"

- Jika tahap = "mengevaluasi_jawaban_siswa":
  * Bandingkan jawaban siswa dengan materi buku.
  * Jika BENAR: apresiasi singkat + penjelasan tambahan penguat pemahaman.
  * Jika SALAH: beri jawaban benar + penjelasan kenapa, dengan bahasa
    yang mendukung dan tidak menghakimi.

ATURAN BAHASA:
- Sesuaikan dengan jenjang (SD/SMP/SMA), sederhana, suportif.

ATURAN CONFIDENCE:
- Sertakan tingkat keyakinan berdasarkan similarity retrieval, bukan angka acak.
```

**Catatan integrasi:** field `tahap` dikirim aplikasi ke prompt, JANGAN biarkan
LLM menebak sendiri sedang di tahap mana.

---

## 7. Urutan Pengerjaan yang Disarankan

Urutan ini SENGAJA berbeda dari intuisi awal. Alasannya: percuma alur Socratic
bagus kalau materi yang dijelaskan salah. Betulkan ISI dulu, baru ALUR.

```
LANGKAH 1 — Perkuat RAG (perbaiki Bug 3.1)  ← PRIORITAS TERTINGGI
  - Pastikan PDF buku → chunk → embed → ChromaDB berjalan benar
  - Pastikan jawaban HANYA disusun dari chunk yang di-retrieve
  - Uji: "apa lambang sila ke-3?" harus benar (pohon beringin)

LANGKAH 2 — Audit & perbaiki confidence score (perbaiki Bug 3.2)
  - Hubungkan confidence ke similarity score retrieval
  - Similarity rendah → jawab "materi belum tersedia"

LANGKAH 3 — Tambah state/flag tracking (Improvement 4.2)
  - Simpan "tahap" percakapan per sesi di MongoDB
  - Nilai: "pertanyaan_baru" | "mengevaluasi_jawaban_siswa"

LANGKAH 4 — Rombak system prompt + terapkan alur Socratic (Improvement 4.1/4.3)
  - Integrasikan draf prompt bagian 6 dengan field "tahap" dari Langkah 3
  - Terapkan aturan anti-bocor jawaban (bagian 5)
  - Uji alur penuh: tanya → konteks → tanya balik → jawab → evaluasi
```

---

## 8. Kriteria Selesai (Definition of Done)

Perbaikan dianggap berhasil jika ketiga jenis uji ini lolos:

1. **Uji akurasi (materi ada):**
   "Kapan Pancasila disahkan?" → 18 Agustus 1945 (benar, dari buku)

2. **Uji alur Socratic:**
   "Apa lambang sila ke-3?" → EduNusa TIDAK langsung menjawab; memberi konteks
   tanpa bocor, bertanya balik; setelah anak menjawab, baru evaluasi.

3. **Uji batasan (materi tak ada):**
   "Siapa presiden Amerika?" → "Maaf, materi ini belum tersedia di EduNusa."

---

## 9. Yang TIDAK Dikerjakan Sekarang (Ditunda)

- **Fine-tuning model** — tunda sampai prototype terbukti & ada ratusan contoh
  percakapan nyata dari murid. RAG + system prompt sudah cukup untuk fase ini.
- **Multi-mapel & multi-jenjang** — mulai dari 1 mapel (PPKn Kelas 4 SD) dulu,
  buktikan works, baru melebar.
- **Bahasa daerah** — versi berikutnya.
