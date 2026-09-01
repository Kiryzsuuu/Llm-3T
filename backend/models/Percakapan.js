const mongoose = require('mongoose');

// Satu dokumen = satu THREAD percakapan penuh (bisa berisi banyak putaran tanya-jawab), berbeda
// dari AiSesi yang cuma menyimpan state SATU putaran Socratic yang sedang berlangsung. Dipakai
// untuk fitur riwayat chat ala ChatGPT/Claude di sidebar - murid bisa lihat percakapan lama dan
// melanjutkannya, bukan cuma riwayat yang hilang begitu halaman di-refresh.
const pesanSchema = new mongoose.Schema(
  {
    pertanyaan: { type: String, required: true },
    jawaban: { type: String, required: true },
    tahap: { type: String, enum: ['menunggu_jawaban_siswa', 'selesai', null], default: null },
    confidence: { type: Number },
    sumber: [{ text: String, metadata: mongoose.Schema.Types.Mixed }],
    isJawabanSiswa: { type: Boolean, default: false },
    isPicker: { type: Boolean, default: false },
    // Disimpan supaya percakapan yang dimuat ulang dari riwayat (tahap masih 'menunggu_jawaban_siswa')
    // bisa benar-benar dilanjutkan - tanpa ini, sesi Socratic yang sedang berlangsung jadi putus
    // begitu murid pindah halaman/refresh, walau riwayat percakapannya sendiri tetap tersimpan.
    sesi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AiSesi' },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const percakapanSchema = new mongoose.Schema(
  {
    murid_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    materi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Materi' },
    // Nama mapel yang terkunci untuk percakapan umum (lihat fitur pemilihan mapel di awal chat) -
    // 'bebas' kalau siswa pilih diskusi bebas, null kalau belum sempat memilih sama sekali.
    mapel_terpilih: { type: String, default: null },
    // Diturunkan otomatis dari pertanyaan pertama (dipotong), supaya sidebar riwayat punya label
    // yang bermakna tanpa mewajibkan siswa mengetik judul sendiri - sama seperti ChatGPT/Claude.
    judul: { type: String, default: 'Percakapan baru' },
    pesan: [pesanSchema],
  },
  { timestamps: true }
);

percakapanSchema.index({ murid_id: 1, updatedAt: -1 });

module.exports = mongoose.model('Percakapan', percakapanSchema);
