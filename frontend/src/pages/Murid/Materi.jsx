import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { cacheMateri } from '../../utils/offlineCache';
import { getAllItems } from '../../utils/localDB';
import MateriCard from '../../components/MateriCard';

export default function MuridMateri() {
  const [materi, setMateri] = useState([]);
  const [mapelAktif, setMapelAktif] = useState('semua');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/materi');
        setMateri(data);
        await cacheMateri(data);
      } catch (err) {
        setMateri(await getAllItems('materi'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const mapelList = useMemo(() => ['semua', ...new Set(materi.map((m) => m.mapel))], [materi]);
  const materiTampil = mapelAktif === 'semua' ? materi : materi.filter((m) => m.mapel === mapelAktif);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-gray-900">Mata Pelajaran</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {mapelList.map((mapel) => (
          <button
            key={mapel}
            onClick={() => setMapelAktif(mapel)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              mapelAktif === mapel ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {mapel === 'semua' ? 'Semua' : mapel}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Memuat materi...</p>
      ) : materiTampil.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada materi tersedia.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {materiTampil.map((m) => (
            <MateriCard key={m._id} materi={m} />
          ))}
        </div>
      )}
    </div>
  );
}
