import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';
import { cacheMateri } from '../../utils/offlineCache';
import { getAllItems } from '../../utils/localDB';
import MateriCard from '../../components/MateriCard';
import AITutor from '../../components/AITutor';

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-2xl">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function MuridDashboard() {
  const user = getUser();
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
    const hariBelajar = new Set(
      progress.filter((p) => p.last_accessed).map((p) => new Date(p.last_accessed).toDateString())
    ).size;

    return { materiSelesai, soalDikerjakan, hariBelajar };
  }, [progress]);

  const mapelUnik = useMemo(() => [...new Set(materi.map((m) => m.mapel))], [materi]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Halo, {user?.nama || 'Murid'} 👋</h1>
        <p className="text-sm text-gray-500">Yuk lanjutkan belajarmu hari ini.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Materi selesai" value={stats.materiSelesai} icon="📘" />
        <StatCard label="Soal dikerjakan" value={stats.soalDikerjakan} icon="✏️" />
        <StatCard label="Hari belajar" value={stats.hariBelajar} icon="🔥" />
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-gray-900">Mata Pelajaran</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Memuat materi...</p>
        ) : mapelUnik.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada materi tersedia.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {materi.map((m) => {
              const p = progressByMateri.get(m._id);
              const persen = p && p.soal_dikerjakan > 0 ? Math.round((p.soal_benar / p.soal_dikerjakan) * 100) : 0;
              return <MateriCard key={m._id} materi={m} persenProgress={persen} />;
            })}
          </div>
        )}
      </div>

      <AITutor jenjang={user?.jenjang} />
    </div>
  );
}
