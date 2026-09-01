import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../utils/api';

const PESAN_PEMBUKA = 'Halo! Aku EduNusa. Ada yang ingin kamu tanyakan tentang pelajaranmu?';
const PESAN_TANYA_MAPEL = 'Sebelum mulai, kamu mau belajar/diskusi mata pelajaran apa? Atau mau diskusi bebas aja?';
const MAPEL_BEBAS = 'bebas';

// Dipakai supaya ketika siswa mengetik bebas (bukan klik chip), jawabannya tetap dikunci ke NAMA
// mapel yang persis sama dengan yang tersimpan di vector store (lihat backend/routes/materi.js -
// metadata.mapel diisi dari Materi.mapel.nama). Kalau nama yang dikirim ke backend tidak persis
// cocok, filter retrieval di rag.js akan menghasilkan 0 chunk sama sekali (bukan sekadar kurang
// akurat), jadi pencocokan longgar HANYA dilakukan di sini, bukan dikirim mentah-mentah ke server.
function cocokkanMapel(teksInput, daftarMapel) {
  const bersih = teksInput.trim().toLowerCase();
  if (!bersih) return null;
  if (/\b(bebas|semua|apa\s*saja|apa\s*aja|terserah|tidak\s*usah|nggak\s*usah|ga\s*usah)\b/.test(bersih)) {
    return MAPEL_BEBAS;
  }
  const persis = daftarMapel.find((m) => m.toLowerCase() === bersih);
  if (persis) return persis;
  const sebagian = daftarMapel.find((m) => bersih.includes(m.toLowerCase()) || m.toLowerCase().includes(bersih));
  return sebagian || null;
}

// Deteksi permintaan eksplisit untuk ganti mapel di tengah obrolan (bukan pertanyaan materi biasa),
// supaya konteks yang sudah "dikunci" bisa direset dan EduNusa menanyakan mapel lagi dari awal -
// tanpa ini, retrieval akan tetap bias ke mapel lama walau siswa sudah pindah topik.
const POLA_GANTI_MAPEL = /ganti\s+(mata\s+pelajaran|mapel|pelajaran)/i;

// Selagi picker aktif, siswa yang cuma menyapa ("halo") sebelum menjawab mau mapel apa TIDAK boleh
// dianggap sebagai percobaan menyebut nama mapel yang gagal dikenali - pesan "aku belum kenal mapel
// itu" jadi salah sasaran dan membingungkan kalau dipakai untuk sapaan biasa.
const POLA_SAPAAN = /^(halo+|hai+|hello+|hallo+|hi+|assalamu'?alaikum|selamat (pagi|siang|sore|malam))[\s!.,?]*$/i;

function formatWaktuRelatif(iso) {
  const detik = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'Baru saja';
  if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 2592000) return `${Math.floor(detik / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function AITutor({ materiId, jenjang, tagPembuka, saran = [] }) {
  const [pertanyaan, setPertanyaan] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusOnline, setStatusOnline] = useState(null);
  const [sesiAktif, setSesiAktif] = useState(null); // { id, tahap: 'menunggu_jawaban_siswa' } | null

  // Mode pemilihan mapel HANYA berlaku untuk chat umum (dashboard, tanpa materiId) - chat yang
  // sudah terikat ke satu materi spesifik otomatis sudah tahu mapelnya, tidak perlu ditanya lagi.
  const modePilihMapel = !materiId;
  const [daftarMapel, setDaftarMapel] = useState([]);
  const [mapelIdMap, setMapelIdMap] = useState({}); // { [namaMapel]: _id } - buat ambil daftar topik nyata saat mapel dipilih
  const [mapelTerpilih, setMapelTerpilih] = useState(null); // nama mapel | MAPEL_BEBAS | null (belum dipilih)
  const [pesanPicker, setPesanPicker] = useState(modePilihMapel ? PESAN_TANYA_MAPEL : null);

  // Riwayat percakapan ala ChatGPT/Claude - HANYA untuk chat umum (dashboard). Chat yang terikat ke
  // satu materi (MateriDetail) tetap sesederhana sebelumnya, tanpa sidebar, supaya scope-nya jelas.
  const dukungRiwayat = modePilihMapel;
  const [daftarPercakapan, setDaftarPercakapan] = useState([]);
  const [percakapanId, setPercakapanId] = useState(null); // null = percakapan baru, belum tersimpan
  const [sidebarTerbuka, setSidebarTerbuka] = useState(false);

  // Chip saran yang mengikuti mapel yang sedang dibahas (bukan 3 contoh statis yang sama terus) -
  // diisi dari topik materi ASLI begitu mapel dipilih, lihat ambilTopikMapel/pilihMapel.
  const [saranAdaptif, setSaranAdaptif] = useState([]); // [{ label, materiId }]

  useEffect(() => {
    let batal = false;

    async function cekStatus() {
      try {
        const { data } = await api.get('/ai/status');
        if (!batal) setStatusOnline(data.status === 'online');
      } catch (err) {
        if (!batal) setStatusOnline(false);
      }
    }

    cekStatus();
    const interval = setInterval(cekStatus, 30000);
    return () => {
      batal = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!modePilihMapel) return;
    let batal = false;
    api
      .get('/mapel')
      .then(({ data }) => {
        if (batal) return;
        setDaftarMapel(data.map((m) => m.nama));
        const peta = {};
        data.forEach((m) => { peta[m.nama] = m._id; });
        setMapelIdMap(peta);
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [modePilihMapel]);

  async function muatDaftarPercakapan() {
    if (!dukungRiwayat) return;
    try {
      const { data } = await api.get('/percakapan');
      setDaftarPercakapan(data);
    } catch (err) {
      // Riwayat gagal dimuat (mis. offline) bukan alasan untuk mem-blokir chat itu sendiri.
    }
  }

  useEffect(() => {
    muatDaftarPercakapan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dukungRiwayat]);

  async function muatPercakapan(id) {
    if (loading) return;
    try {
      const { data } = await api.get(`/percakapan/${id}`);
      setPercakapanId(data._id);
      setRiwayat(
        (data.pesan || []).map((p) => ({
          pertanyaan: p.pertanyaan,
          jawaban: p.jawaban,
          tahap: p.tahap,
          confidence: p.confidence,
          sumber: p.sumber || [],
          isJawabanSiswa: p.isJawabanSiswa,
        }))
      );
      const mapelPercakapan = data.mapel_terpilih || MAPEL_BEBAS;
      setMapelTerpilih(mapelPercakapan);
      setPesanPicker(null);
      setSaranAdaptif(mapelPercakapan !== MAPEL_BEBAS ? await ambilTopikMapel(mapelIdMap[mapelPercakapan]) : []);

      const pesanTerakhir = (data.pesan || [])[data.pesan.length - 1];
      setSesiAktif(
        pesanTerakhir && pesanTerakhir.tahap === 'menunggu_jawaban_siswa' && pesanTerakhir.sesi_id
          ? { id: pesanTerakhir.sesi_id, tahap: 'menunggu_jawaban_siswa' }
          : null
      );

      setError('');
      setSidebarTerbuka(false);
    } catch (err) {
      setError('Gagal memuat percakapan ini.');
    }
  }

  function percakapanBaru() {
    setPercakapanId(null);
    setRiwayat([]);
    setSesiAktif(null);
    setError('');
    setMapelTerpilih(null);
    setPesanPicker(PESAN_TANYA_MAPEL);
    setSidebarTerbuka(false);
    setSaranAdaptif([]);
  }

  // Dipakai supaya chip topik (baik yang muncul sesaat setelah pilih mapel, maupun yang jadi
  // suggestion persisten di dekat kolom input) selalu berisi topik yang BENAR-BENAR ada isinya
  // di RAG - diambil dari data materi asli, bukan digenerate/ditebak AI.
  async function ambilTopikMapel(mapelId) {
    if (!mapelId) return [];
    try {
      const { data } = await api.get('/materi', { params: { mapel: mapelId } });
      const peta = new Map();
      data.forEach((m) => {
        const label = (m.bab || m.judul || '').trim();
        if (label && !peta.has(label)) peta.set(label, m._id);
      });
      return [...peta.entries()].map(([label, materiId]) => ({ label, materiId })).slice(0, 8);
    } catch (err) {
      return [];
    }
  }

  async function hapusPercakapan(e, id) {
    e.stopPropagation();
    try {
      await api.delete(`/percakapan/${id}`);
      setDaftarPercakapan((prev) => prev.filter((p) => p._id !== id));
      if (id === percakapanId) percakapanBaru();
    } catch (err) {
      // Diamkan - item tetap ada di daftar kalau hapus gagal, murid bisa coba lagi.
    }
  }

  // Dibuat lebih "seperti guru" - begitu mapel dipilih, EduNusa langsung menampilkan daftar topik
  // NYATA yang tersedia (dari materi yang sudah diupload guru/admin) dan minta murid pilih salah
  // satu, bukan cuma "tanya apa saja" generik. Diambil langsung dari data materi (bukan digenerate
  // AI) supaya topik yang ditawarkan pasti benar-benar ada isinya di RAG, tidak mengarang.
  async function pilihMapel(pilihan) {
    setMapelTerpilih(pilihan);
    setPesanPicker(null);

    if (pilihan === MAPEL_BEBAS) {
      setSaranAdaptif([]);
      setRiwayat((prev) => [
        ...prev,
        {
          pertanyaan: 'Diskusi bebas',
          jawaban: 'Oke, kita diskusi bebas aja ya! Tanya apa saja yang ingin kamu ketahui.',
          sumber: [],
          tahap: null,
          confidence: null,
          isPicker: true,
        },
      ]);
      return;
    }

    const topikList = await ambilTopikMapel(mapelIdMap[pilihan]);
    setSaranAdaptif(topikList);

    const jawaban =
      topikList.length > 0
        ? `Oke, kita bahas mata pelajaran **${pilihan}** ya! Beberapa topik yang tersedia:\n\n${topikList
            .map((t) => `- ${t.label}`)
            .join('\n')}\n\nMau mulai dari topik yang mana? Atau tanya bebas juga boleh!`
        : `Oke, kita bahas mata pelajaran **${pilihan}** ya! Tanya apa saja tentang mapel ini.`;

    setRiwayat((prev) => [
      ...prev,
      { pertanyaan: pilihan, jawaban, sumber: [], tahap: null, confidence: null, isPicker: true, topikSaran: topikList },
    ]);
  }

  async function kirimPertanyaan(teks, opsi = {}) {
    if (!teks.trim() || loading) return;

    const sedangMenjawab = sesiAktif?.tahap === 'menunggu_jawaban_siswa';

    // Selagi picker aktif (belum ada mapel terkunci), pesan yang diketik siswa adalah JAWABAN atas
    // pertanyaan "mau mapel apa" - bukan pertanyaan materi biasa, jadi jangan dikirim ke backend.
    if (modePilihMapel && mapelTerpilih === null) {
      const cocok = cocokkanMapel(teks, daftarMapel);
      setPertanyaan('');
      if (cocok) {
        pilihMapel(cocok);
      } else {
        const jawaban = POLA_SAPAAN.test(teks.trim())
          ? 'Halo juga! Sebelum lanjut, mau belajar/diskusi mata pelajaran apa? Atau mau diskusi bebas aja?'
          : 'Hmm, aku belum kenal mapel itu. Coba pilih salah satu dari daftar di bawah, atau ketik "diskusi bebas".';
        setRiwayat((prev) => [
          ...prev,
          { pertanyaan: teks, jawaban, sumber: [], tahap: null, confidence: null, isPicker: true },
        ]);
      }
      return;
    }

    // Siswa minta ganti mapel di tengah obrolan - reset kunci mapel dan tanyakan lagi dari awal,
    // supaya pertanyaan berikutnya tidak tetap bias ke mapel yang lama.
    if (modePilihMapel && mapelTerpilih !== null && !sedangMenjawab && POLA_GANTI_MAPEL.test(teks)) {
      setPertanyaan('');
      setRiwayat((prev) => [
        ...prev,
        { pertanyaan: teks, jawaban: 'Oke! ' + PESAN_TANYA_MAPEL, sumber: [], tahap: null, confidence: null, isPicker: true },
      ]);
      setMapelTerpilih(null);
      setSaranAdaptif([]);
      return;
    }

    setLoading(true);
    setError('');
    setPertanyaan('');

    try {
      const { data } = await api.post('/ai/tanya', {
        pertanyaan: teks,
        materi_id: materiId || opsi.materiIdTopik,
        mapel: modePilihMapel && mapelTerpilih && mapelTerpilih !== MAPEL_BEBAS ? mapelTerpilih : undefined,
        jenjang,
        sesi_id: sedangMenjawab ? sesiAktif.id : undefined,
        percakapan_id: dukungRiwayat ? percakapanId : undefined,
        // "Dipercaya tanpa gerbang kata kunci" HANYA saat teksnya berasal dari chip topik yang
        // dibuat dari label materi asli (lihat backend/ai-service/rag.js) - bukan pertanyaan bebas.
        dari_topik_saran: !!opsi.materiIdTopik,
      });

      setRiwayat((prev) => [...prev, { pertanyaan: teks, ...data, isJawabanSiswa: sedangMenjawab }]);

      if (data.tahap === 'menunggu_jawaban_siswa' && data.sesi_id) {
        setSesiAktif({ id: data.sesi_id, tahap: 'menunggu_jawaban_siswa' });
      } else {
        setSesiAktif(null);
      }

      if (dukungRiwayat && data.percakapan_id) {
        setPercakapanId(data.percakapan_id);
        muatDaftarPercakapan();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'EduNusa sedang tidak tersedia. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    kirimPertanyaan(pertanyaan);
  }

  const sedangMenungguJawaban = sesiAktif?.tahap === 'menunggu_jawaban_siswa';

  return (
    <div className="edunusa">
      <div className="edu-head">
        {dukungRiwayat && (
          <button
            type="button"
            className="edu-sidebar-toggle"
            onClick={() => setSidebarTerbuka((v) => !v)}
            aria-label="Tampilkan/sembunyikan riwayat percakapan"
          >
            <i className="ti ti-layout-sidebar" />
          </button>
        )}
        <div className="edu-logo">
          <i className="ti ti-sparkles" />
        </div>
        <div>
          <div className="edu-name">EduNusa</div>
          <div className="edu-tag">{tagPembuka || 'Asisten belajarmu · berbasis kurikulum Kemendikbud'}</div>
        </div>
        {statusOnline !== null && (
          <div className={`edu-status ${statusOnline ? '' : 'off'}`}>
            <span className="edu-dot" />
            {statusOnline ? 'Aktif' : 'Offline'}
          </div>
        )}
      </div>

      <div className="edu-layout">
        {dukungRiwayat && sidebarTerbuka && (
          <div className="edu-sidebar-backdrop" onClick={() => setSidebarTerbuka(false)} />
        )}

        {dukungRiwayat && (
          <div className={`edu-sidebar ${sidebarTerbuka ? 'open' : ''}`}>
            <button type="button" className="edu-sidebar-new" onClick={percakapanBaru}>
              <i className="ti ti-plus" /> Percakapan Baru
            </button>
            <div className="edu-sidebar-list">
              {daftarPercakapan.length === 0 && (
                <div className="edu-sidebar-empty">Belum ada percakapan tersimpan.</div>
              )}
              {daftarPercakapan.map((p) => (
                <div
                  key={p._id}
                  className={`edu-sidebar-item ${p._id === percakapanId ? 'active' : ''}`}
                  onClick={() => muatPercakapan(p._id)}
                >
                  <div className="edu-sidebar-item-text">
                    <div className="edu-sidebar-item-judul">{p.judul}</div>
                    <div className="edu-sidebar-item-waktu">{formatWaktuRelatif(p.updatedAt)}</div>
                  </div>
                  <button
                    type="button"
                    className="edu-sidebar-item-hapus"
                    onClick={(e) => hapusPercakapan(e, p._id)}
                    aria-label="Hapus percakapan"
                  >
                    <i className="ti ti-trash" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="edu-body">
          <div className="bubble bot">{PESAN_PEMBUKA}</div>
          {pesanPicker && <div className="bubble bot">{pesanPicker}</div>}

          {riwayat.map((item, i) => (
            <div key={i}>
              <div className="bubble user">{item.pertanyaan}</div>
              <div className="bubble bot">
                <div className="bubble-markdown">
                  <ReactMarkdown>{item.jawaban}</ReactMarkdown>
                </div>
                {item.tahap === 'menunggu_jawaban_siswa' && (
                  <div className="src-pill">
                    <i className="ti ti-message-question" />
                    Coba jawab dulu ya, sebelum aku kasih tahu jawaban lengkapnya!
                  </div>
                )}
                {typeof item.confidence === 'number' && item.confidence > 0 && (
                  <div className="src-pill">
                    <i className="ti ti-gauge" />
                    Keyakinan jawaban: {Math.round(item.confidence * 100)}%
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && <div className="bubble bot text-muted">EduNusa sedang berpikir...</div>}

          {error && (
            <div className="alert red">
              <i className="ti ti-alert-circle" />
              <div>{error}</div>
            </div>
          )}

          {sedangMenungguJawaban && !loading && (
            <div className="alert blue">
              <i className="ti ti-bulb" />
              <div>EduNusa sedang menunggu jawabanmu di kotak di bawah ini.</div>
            </div>
          )}

          {modePilihMapel && mapelTerpilih === null && !loading && (
            <div className="edu-chips">
              {daftarMapel.map((m) => (
                <div key={m} className="edu-chip" onClick={() => pilihMapel(m)}>
                  {m}
                </div>
              ))}
              <div className="edu-chip" onClick={() => pilihMapel(MAPEL_BEBAS)}>
                Diskusi Bebas
              </div>
            </div>
          )}

          {!sedangMenungguJawaban && !(modePilihMapel && mapelTerpilih === null) && (
            <>
              {saranAdaptif.length > 0 ? (
                // Mengikuti mapel yang sedang dibahas - topik nyata dari materi, bukan 3 contoh
                // statis yang sama terus dipakai apa pun mapelnya.
                <div className="edu-chips">
                  {saranAdaptif.map((t) => (
                    <div
                      key={t.label}
                      className="edu-chip"
                      onClick={() => kirimPertanyaan(`Jelaskan tentang ${t.label}`, { materiIdTopik: t.materiId })}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>
              ) : (
                saran.length > 0 && (
                  <div className="edu-chips">
                    {saran.map((s) => (
                      <div key={s} className="edu-chip" onClick={() => kirimPertanyaan(s)}>
                        {s}
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}

          <form onSubmit={handleSubmit} className="edu-input">
            <input
              type="text"
              value={pertanyaan}
              onChange={(e) => setPertanyaan(e.target.value)}
              placeholder={
                modePilihMapel && mapelTerpilih === null
                  ? 'Ketik mata pelajaran, atau "diskusi bebas"...'
                  : sedangMenungguJawaban
                    ? 'Tulis jawabanmu di sini...'
                    : 'Tanya apa saja tentang pelajaranmu...'
              }
            />
            <button type="submit" disabled={loading}>
              Kirim
            </button>
          </form>

          <div className="edu-disclaimer">EduNusa menjawab berdasarkan kurikulum Kemendikbud</div>
        </div>
      </div>
    </div>
  );
}
