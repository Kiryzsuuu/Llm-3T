import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';
import ProgressBar from '../../components/ProgressBar';

const HARI_TIDAK_AKTIF = 7;

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-1 text-2xl">{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function hitungPersen(m) {
  if (!m.total_soal_dikerjakan) return 0;
  return Math.round((m.total_soal_benar / m.total_soal_dikerjakan) * 100);
}

function hariSejak(tanggal) {
  if (!tanggal) return Infinity;
  return Math.floor((Date.now() - new Date(tanggal).getTime()) / (1000 * 60 * 60 * 24));
}

export default function GuruDashboard() {
  const user = getUser();
  const [murid, setMurid] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/progress/guru/${encodeURIComponent(user?.sekolah || '')}`);
        setMurid(data);
      } catch (err) {
        setMurid([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.sekolah]);

  const stats = useMemo(() => {
    const totalMurid = murid.length;
    const persenList = murid.map(hitungPersen).filter((p) => p > 0);
    const rataRata = persenList.length
      ? Math.round(persenList.reduce((a, b) => a + b, 0) / persenList.length)
      : 0;
    const tidakAktif = murid.filter((m) => hariSejak(m.last_accessed) > HARI_TIDAK_AKTIF);

    return { totalMurid, rataRata, tidakAktif };
  }, [murid]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard Guru</h1>
        <p className="text-sm text-gray-500">{user?.sekolah || 'Sekolah belum diatur'}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Murid aktif" value={stats.totalMurid} icon="👥" />
        <StatCard label="Rata-rata skor" value={`${stats.rataRata}%`} icon="📊" />
      </div>

      {stats.tidakAktif.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="mb-1 font-semibold text-yellow-800">⚠ {stats.tidakAktif.length} murid tidak aktif</p>
          <p className="text-sm text-yellow-700">
            {stats.tidakAktif.map((m) => m.nama).join(', ')} belum belajar lebih dari {HARI_TIDAK_AKTIF} hari.
          </p>
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Progress Murid</h2>
          <Link to="/guru/murid" className="text-sm font-medium text-brand-600">
            Lihat semua
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Memuat data...</p>
        ) : murid.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada data murid.</p>
        ) : (
          <div className="space-y-3">
            {murid.slice(0, 5).map((m) => (
              <div key={m.murid_id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{m.nama}</span>
                  <span className="text-xs text-gray-500">Kelas {m.kelas}</span>
                </div>
                <ProgressBar persen={hitungPersen(m)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
