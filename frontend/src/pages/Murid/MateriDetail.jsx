import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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

  if (loading) return <p className="container text-muted">Memuat materi...</p>;
  if (!materi) return <p className="container text-muted">Materi tidak ditemukan.</p>;

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="breadcrumb">
        <Link to="/murid/materi">Materi</Link> · {materi.mapel} · Kelas {materi.kelas}
      </div>

      <div className="flex items-start justify-between gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500 }}>{materi.judul}</div>
          <div className="flex gap-2 mt-2">
            <span className="badge teal">{materi.mapel}</span>
            <span className="badge blue">Kelas {materi.kelas}</span>
            {materi.bab && <span className="badge amber">{materi.bab}</span>}
          </div>
        </div>
        <button className={`btn ${disimpanOffline ? '' : 'ghost'}`} onClick={handleToggleOffline} disabled={mengunduh}>
          <i className={`ti ${disimpanOffline ? 'ti-circle-check' : 'ti-download'}`} />
          {mengunduh ? 'Menyimpan...' : disimpanOffline ? 'Tersimpan offline' : 'Simpan offline'}
        </button>
      </div>

      <div className="prose">
        {materi.konten}
        {materi.file_url && (
          <p className="mt-3">
            <a href={materi.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--teal-acc)' }}>
              <i className="ti ti-paperclip" /> Lihat file lampiran
            </a>
          </p>
        )}
      </div>

      <button className="btn big" style={{ margin: '24px 0' }} onClick={() => navigate(`/murid/latihan/${materi._id}`)}>
        <i className="ti ti-pencil" /> Mulai latihan soal
      </button>

      <AITutor
        materiId={materi._id}
        jenjang={materi.jenjang}
        tagPembuka={`Bertanya seputar: ${materi.judul}`}
        saran={[`Apa fungsi utama dari ${materi.judul}?`, 'Jelaskan lebih sederhana']}
      />
    </div>
  );
}
