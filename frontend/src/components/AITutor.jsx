import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import api from '../utils/api';

const PESAN_PEMBUKA = 'Halo! Aku EduNusa. Ada yang ingin kamu tanyakan tentang pelajaranmu?';

export default function AITutor({ materiId, jenjang, tagPembuka, saran = [] }) {
  const [pertanyaan, setPertanyaan] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusOnline, setStatusOnline] = useState(null);
  const [sesiAktif, setSesiAktif] = useState(null); // { id, tahap: 'menunggu_jawaban_siswa' } | null

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

  async function kirimPertanyaan(teks) {
    if (!teks.trim() || loading) return;

    setLoading(true);
    setError('');
    setPertanyaan('');

    const sedangMenjawab = sesiAktif?.tahap === 'menunggu_jawaban_siswa';

    try {
      const { data } = await api.post('/ai/tanya', {
        pertanyaan: teks,
        materi_id: materiId,
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

        {saran.length > 0 && !sedangMenungguJawaban && (
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
            placeholder={sedangMenungguJawaban ? 'Tulis jawabanmu di sini...' : 'Tanya apa saja tentang pelajaranmu...'}
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
