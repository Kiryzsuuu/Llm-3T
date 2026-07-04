import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getItem } from '../../utils/localDB';
import { downloadMateri, isMateriOffline, hapusMateriOffline } from '../../utils/offlineCache';
import AITutor from '../../components/AITutor';

export default function MateriDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [materi, setMateri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disimpanOffline, setDisimpanOffline] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/materi/${id}`);
        setMateri(data);
      } catch (err) {
        const cached = (await getItem('materiOffline', id)) || (await getItem('materi', id));
        setMateri(cached || null);
      } finally {
        setLoading(false);
      }
    }
    load();
    isMateriOffline(id).then(setDisimpanOffline);
  }, [id]);

  async function handleToggleOffline() {
    if (disimpanOffline) {
      await hapusMateriOffline(id);
      setDisimpanOffline(false);
      return;
    }

    setMengunduh(true);
    try {
      await downloadMateri(id);
      setDisimpanOffline(true);
    } catch (err) {
      alert('Gagal menyimpan materi untuk offline. Coba lagi saat online.');
    } finally {
      setMengunduh(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-500">Memuat materi...</p>;
  if (!materi) return <p className="p-4 text-sm text-gray-500">Materi tidak ditemukan.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
          {materi.mapel} · {materi.jenjang} · Kelas {materi.kelas}
        </p>
        <h1 className="mb-3 text-xl font-bold text-gray-900">{materi.judul}</h1>

        <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">{materi.konten}</div>

        {materi.file_url && (
          <a
            href={materi.file_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm font-medium text-brand-600 underline"
          >
            Lihat file lampiran
          </a>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleToggleOffline}
            disabled={mengunduh}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {mengunduh ? 'Menyimpan...' : disimpanOffline ? '✓ Tersimpan offline (hapus)' : '⬇ Simpan offline'}
          </button>
          <button
            onClick={() => navigate(`/murid/latihan/${materi._id}`)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Mulai Latihan
          </button>
        </div>
      </div>

      <AITutor materiId={materi._id} jenjang={materi.jenjang} />
    </div>
  );
}
