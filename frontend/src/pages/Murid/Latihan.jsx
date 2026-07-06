import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { cacheSoal } from '../../utils/offlineCache';
import { getAllItems, simpanProgress, simpanJawaban } from '../../utils/localDB';
import { syncProgressKeServer } from '../../utils/syncManager';
import { getUser } from '../../utils/auth';

const HURUF = ['A', 'B', 'C', 'D'];
const WARNA_LEVEL = { mudah: 'teal', sedang: 'amber', sulit: 'red' };

export default function Latihan() {
  const { materi_id } = useParams();
  const navigate = useNavigate();
  const user = getUser();

  const [soalList, setSoalList] = useState([]);
  const [index, setIndex] = useState(0);
  const [jawaban, setJawaban] = useState({}); // { [index]: pilihanIndex }
  const [loading, setLoading] = useState(true);
  const [selesai, setSelesai] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/soal', { params: { materi_id } });
        setSoalList(data);
        await cacheSoal(data);
      } catch (err) {
        const cached = await getAllItems('soal');
        setSoalList(cached.filter((s) => s.materi_id === materi_id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [materi_id]);

  const soal = soalList[index];
  const sudahJawab = jawaban[index] !== undefined;
  const skor = useMemo(
    () => Object.entries(jawaban).filter(([i, v]) => soalList[i]?.jawaban_benar === v).length,
    [jawaban, soalList]
  );

  async function handlePilih(idx) {
    if (sudahJawab) return;
    setJawaban((prev) => ({ ...prev, [index]: idx }));

    await simpanJawaban({
      murid_id: user?.id,
      materi_id,
      soal_id: soal._id,
      jawaban: idx,
      benar: idx === soal.jawaban_benar,
    });
  }

  async function handleSelesai() {
    setMenyimpan(true);
    const progressItem = {
      materi_id,
      soal_dikerjakan: soalList.length,
      soal_benar: skor,
      status: 'selesai',
    };
    try {
      await api.post('/progress', progressItem);
    } catch (err) {
      await simpanProgress(progressItem);
      syncProgressKeServer();
    } finally {
      setMenyimpan(false);
      setSelesai(true);
    }
  }

  function handleLanjut() {
    if (index + 1 < soalList.length) setIndex((i) => i + 1);
    else handleSelesai();
  }

  function handleSebelumnya() {
    if (index > 0) setIndex((i) => i - 1);
  }

  if (loading) return <p className="container text-muted">Memuat soal...</p>;

  if (soalList.length === 0) {
    return (
      <div className="container">
        <p className="text-muted">Belum ada soal untuk materi ini.</p>
      </div>
    );
  }

  if (selesai) {
    const persen = Math.round((skor / soalList.length) * 100);
    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="text-center" style={{ padding: '30px 0' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--teal-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <i className="ti ti-trophy" style={{ fontSize: 36, color: 'var(--teal)' }} />
          </div>
          <div className="text-muted" style={{ fontSize: 15 }}>
            Skor kamu
          </div>
          <div style={{ fontSize: 42, fontWeight: 500, color: 'var(--teal)' }}>{persen}</div>
          <div className="mb-4" style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {skor} dari {soalList.length} soal benar
          </div>
          <div className="flex gap-3" style={{ maxWidth: 360, margin: '0 auto' }}>
            <button
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setIndex(0);
                setJawaban({});
                setSelesai(false);
              }}
            >
              Ulangi
            </button>
            <button className="btn" style={{ flex: 1 }} onClick={() => navigate(`/murid/materi/${materi_id}`)}>
              Kembali ke materi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 680 }}>
      <div className="q-progress">
        <div className="q-bar">
          <div style={{ width: `${((index + 1) / soalList.length) * 100}%` }} />
        </div>
        <div className="q-count">
          Soal {index + 1} dari {soalList.length}
        </div>
      </div>

      <div className="q-card">
        <div className="flex gap-2 mb-2">
          <span className="badge teal">Soal {index + 1}</span>
          <span className={`badge ${WARNA_LEVEL[soal.tingkat_kesulitan] || 'amber'}`}>
            {soal.tingkat_kesulitan || 'sedang'}
          </span>
        </div>
        <div className="q-text">{soal.pertanyaan}</div>

        <div>
          {soal.pilihan.map((opsi, idx) => {
            let kelas = 'opt';
            if (sudahJawab) {
              if (idx === soal.jawaban_benar) kelas += ' right';
              else if (idx === jawaban[index]) kelas += ' wrong';
            }
            return (
              <div key={idx} className={kelas} onClick={() => handlePilih(idx)}>
                <div className="opt-l">{HURUF[idx]}</div>
                {opsi}
              </div>
            );
          })}
        </div>

        {sudahJawab && soal.penjelasan && (
          <div className="explain">
            <strong>Penjelasan:</strong> {soal.penjelasan}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button className="btn ghost" style={{ flex: 1 }} onClick={handleSebelumnya} disabled={index === 0}>
          Sebelumnya
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={handleLanjut} disabled={!sudahJawab || menyimpan}>
          {index + 1 < soalList.length ? 'Soal berikutnya' : menyimpan ? 'Menyimpan...' : 'Selesai'}
        </button>
      </div>
    </div>
  );
}
