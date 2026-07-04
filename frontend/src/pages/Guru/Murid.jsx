import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';
import ProgressBar from '../../components/ProgressBar';

function hitungPersen(m) {
  if (!m.total_soal_dikerjakan) return 0;
  return Math.round((m.total_soal_benar / m.total_soal_dikerjakan) * 100);
}

export default function GuruMurid() {
  const user = getUser();
  const [murid, setMurid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');

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

  const muridTampil = murid.filter((m) => m.nama.toLowerCase().includes(cari.toLowerCase()));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-gray-900">Progress Murid</h1>

      <input
        type="text"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari nama murid..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      {loading ? (
        <p className="text-sm text-gray-500">Memuat data...</p>
      ) : muridTampil.length === 0 ? (
        <p className="text-sm text-gray-500">Tidak ada murid ditemukan.</p>
      ) : (
        <div className="space-y-3">
          {muridTampil.map((m) => (
            <div key={m.murid_id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{m.nama}</p>
                  <p className="text-xs text-gray-500">
                    Kelas {m.kelas} · {m.email}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-700">{hitungPersen(m)}%</span>
              </div>
              <ProgressBar persen={hitungPersen(m)} showPercent={false} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                <span>{m.total_materi} materi</span>
                <span>{m.total_soal_dikerjakan} soal</span>
                <span>{m.materi_selesai} selesai</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
