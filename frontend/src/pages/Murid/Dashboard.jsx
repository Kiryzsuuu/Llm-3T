import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';
import { cacheMateri } from '../../utils/offlineCache';
import { getAllItems } from '../../utils/localDB';
import MateriCard from '../../components/MateriCard';
import AITutor from '../../components/AITutor';

function sapaanWaktu() {
  const jam = new Date().getHours();
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export default function MuridDashboard() {
  const user = getUser();
  const navigate = useNavigate();
  const [materi, setMateri] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: materiData } = await api.get('/materi', {
          params: { jenjang: user?.jenjang, kelas: user?.kelas },
        });
        setMateri(materiData);
        await cacheMateri(materiData);
      } catch (err) {
        setMateri(await getAllItems('materi'));
      }

      try {
        if (user?.id) {
          const { data: progressData } = await api.get(`/progress/murid/${user.id}`);
          setProgress(progressData);
        }
      } catch (err) {
        setProgress(await getAllItems('progress'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  const progressByMateri = useMemo(() => {
    const map = new Map();
    progress.forEach((p) => {
      const materiId = typeof p.materi_id === 'object' ? p.materi_id?._id : p.materi_id;
      map.set(materiId, p);
    });
    return map;
  }, [progress]);

  const stats = useMemo(() => {
    const materiSelesai = progress.filter((p) => p.status === 'selesai').length;
    const soalDikerjakan = progress.reduce((sum, p) => sum + (p.soal_dikerjakan || 0), 0);
    const soalBenar = progress.reduce((sum, p) => sum + (p.soal_benar || 0), 0);
    const akurasi = soalDikerjakan > 0 ? Math.round((soalBenar / soalDikerjakan) * 100) : 0;
    const hariBelajar = new Set(
      progress.filter((p) => p.last_accessed).map((p) => new Date(p.last_accessed).toDateString())
    ).size;

    return { materiSelesai, soalDikerjakan, akurasi, hariBelajar };
  }, [progress]);

  const materiLanjutan = useMemo(() => {
    const berjalan = progress
      .filter((p) => p.status !== 'selesai' && p.soal_dikerjakan > 0)
      .sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed))[0];
    if (!berjalan) return null;
    const materiId = typeof berjalan.materi_id === 'object' ? berjalan.materi_id?._id : berjalan.materi_id;
    return materi.find((m) => m._id === materiId);
  }, [progress, materi]);

  return (
    <div className="container">
      <div className="hero">
        <div className="hero-left">
          <div className="hero-avatar">{(user?.nama || '?').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="hero-hi">{sapaanWaktu()}</div>
            <div className="hero-name">
              {user?.nama || 'Murid'} {user?.kelas ? `· Kelas ${user.kelas}` : ''}
            </div>
          </div>
        </div>
        <div className="hero-pill">
          <i className="ti ti-flame" />
          <span className="hero-num">{stats.hariBelajar}</span>
          <span className="hero-lbl">
            hari
            <br />
            beruntun
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--teal-bg)' }}>
            <i className="ti ti-book" style={{ color: 'var(--teal)' }} />
          </div>
          <div className="stat-v">{stats.materiSelesai}</div>
          <div className="stat-l">Materi selesai</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--blue-bg)' }}>
            <i className="ti ti-pencil" style={{ color: 'var(--blue)' }} />
          </div>
          <div className="stat-v">{stats.soalDikerjakan}</div>
          <div className="stat-l">Soal dikerjakan</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--amber-bg)' }}>
            <i className="ti ti-target" style={{ color: 'var(--amber)' }} />
          </div>
          <div className="stat-v">{stats.akurasi}%</div>
          <div className="stat-l">Akurasi jawaban</div>
        </div>
      </div>

      {materiLanjutan && (
        <div className="lanjut">
          <div className="lanjut-ico">
            <i className="ti ti-player-play" />
          </div>
          <div>
            <div className="lanjut-kicker">Lanjutkan belajar</div>
            <div className="lanjut-t">{materiLanjutan.judul}</div>
            <div className="lanjut-s">
              {materiLanjutan.mapel} · {materiLanjutan.bab || `Kelas ${materiLanjutan.kelas}`}
            </div>
          </div>
          <button className="btn" onClick={() => navigate(`/murid/materi/${materiLanjutan._id}`)}>
            Lanjut
          </button>
        </div>
      )}

      <div className="sec-head">
        <div className="sec-title">Mata pelajaran</div>
        <span className="sec-link" onClick={() => navigate('/murid/materi')}>
          Lihat semua
        </span>
      </div>

      {loading ? (
        <p className="text-muted mb-4">Memuat materi...</p>
      ) : materi.length === 0 ? (
        <p className="text-muted mb-4">Belum ada materi tersedia.</p>
      ) : (
        <div className="mapel-grid">
          {materi.slice(0, 8).map((m) => {
            const p = progressByMateri.get(m._id);
            const persen = p && p.soal_dikerjakan > 0 ? Math.round((p.soal_benar / p.soal_dikerjakan) * 100) : 0;
            return <MateriCard key={m._id} materi={m} persenProgress={persen} />;
          })}
        </div>
      )}

      <AITutor
        jenjang={user?.jenjang}
        saran={['Apa itu fotosintesis?', 'Jelaskan hukum Newton', 'Buatkan 3 soal latihan']}
      />
    </div>
  );
}
