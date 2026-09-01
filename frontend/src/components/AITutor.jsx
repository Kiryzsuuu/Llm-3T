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
  const [mapelTerpilih, setMapelTerpilih] = useState(null); // nama mapel | MAPEL_BEBAS | null (belum dipilih)
  const [pesanPicker, setPesanPicker] = useState(modePilihMapel ? PESAN_TANYA_MAPEL : null);

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
        if (!batal) setDaftarMapel(data.map((m) => m.nama));
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [modePilihMapel]);

  function pilihMapel(pilihan) {
    setMapelTerpilih(pilihan);
    setPesanPicker(null);
    setRiwayat((prev) => [
      ...prev,
      {
        pertanyaan: pilihan === MAPEL_BEBAS ? 'Diskusi bebas' : pilihan,
        jawaban:
          pilihan === MAPEL_BEBAS
            ? 'Oke, kita diskusi bebas aja ya! Tanya apa saja yang ingin kamu ketahui.'
            : `Oke, kita bahas mata pelajaran **${pilihan}** ya! Tanya apa saja tentang mapel ini.`,
        sumber: [],
        tahap: null,
        confidence: null,
        isPicker: true,
      },
    ]);
  }

  async function kirimPertanyaan(teks) {
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
        setRiwayat((prev) => [
          ...prev,
          {
            pertanyaan: teks,
            jawaban: 'Hmm, aku belum kenal mapel itu. Coba pilih salah satu dari daftar di bawah, atau ketik "diskusi bebas".',
            sumber: [],
            tahap: null,
            confidence: null,
            isPicker: true,
          },
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
      return;
    }

    setLoading(true);
    setError('');
    setPertanyaan('');

    try {
      const { data } = await api.post('/ai/tanya', {
        pertanyaan: teks,
        materi_id: materiId,
        mapel: modePilihMapel && mapelTerpilih && mapelTerpilih !== MAPEL_BEBAS ? mapelTerpilih : undefined,
        jenjang,
        sesi_id: sedangMenjawab ? sesiAktif.id : undefined,
      });

      setRiwayat((prev) => [...prev, { pertanyaan: teks, ...data, isJawabanSiswa: sedangMenjawab }]);

      if (data.tahap === 'menunggu_jawaban_siswa' && data.sesi_id) {
        setSesiAktif({ id: data.sesi_id, tahap: 'menunggu_jawaban_siswa' });
      } else {
        setSesiAktif(null);
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

        {saran.length > 0 && !sedangMenungguJawaban && !(modePilihMapel && mapelTerpilih === null) && (
          <div className="edu-chips">
            {saran.map((s) => (
              <div key={s} className="edu-chip" onClick={() => kirimPertanyaan(s)}>
                {s}
              </div>
            ))}
          </div>
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
  );
}
