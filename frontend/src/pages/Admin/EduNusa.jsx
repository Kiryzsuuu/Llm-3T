import { useEffect, useState } from 'react';
import api from '../../utils/api';

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function AdminEduNusa() {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mengekspor, setMengekspor] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: statsData }, { data: statusData }] = await Promise.all([
          api.get('/ai/logs/stats'),
          api.get('/ai/status'),
        ]);
        setStats(statsData);
        setStatus(statusData);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat statistik EduNusa');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleExport() {
    setMengekspor(true);
    try {
      const response = await api.get('/ai/logs/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `edunusa-logs-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Gagal mengekspor log ke CSV');
    } finally {
      setMengekspor(false);
    }
  }

  if (loading) return <p className="container text-muted">Memuat statistik EduNusa...</p>;
  if (error) return <p className="container" style={{ color: 'var(--red)' }}>{error}</p>;

  const maxHarian = Math.max(1, ...stats.pertanyaanPerHari.map((d) => d.total));

  return (
    <div className="container">
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <div className="edu-logo" style={{ width: 38, height: 38 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 18 }} />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Statistik EduNusa</div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Model: {status?.model || '-'} ·{' '}
            <span style={{ color: status?.status === 'online' ? 'var(--teal)' : 'var(--red)' }}>
              {status?.status === 'online' ? 'aktif' : status?.status === 'model_tidak_ditemukan' ? 'model belum dibuat' : 'offline'}
            </span>
          </div>
        </div>
        <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={handleExport} disabled={mengekspor}>
          <i className="ti ti-download" /> {mengekspor ? 'Mengekspor...' : 'Export CSV'}
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--teal-bg)' }}>
            <i className="ti ti-message-circle" style={{ color: 'var(--teal)' }} />
          </div>
          <div className="stat-v">{stats.totalPertanyaanHariIni}</div>
          <div className="stat-l">Pertanyaan hari ini</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--blue-bg)' }}>
            <i className="ti ti-calendar-week" style={{ color: 'var(--blue)' }} />
          </div>
          <div className="stat-v">{stats.totalPertanyaanMingguIni}</div>
          <div className="stat-l">Pertanyaan minggu ini</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--amber-bg)' }}>
            <i className="ti ti-clock" style={{ color: 'var(--amber)' }} />
          </div>
          <div className="stat-v">{stats.rataRataResponseTime} ms</div>
          <div className="stat-l">Rata-rata respons</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="p-title">Pertanyaan 7 hari terakhir</div>
          <div className="chart">
            {stats.pertanyaanPerHari.map((d) => (
              <div className="col" key={d.tanggal}>
                <div className="colbar" style={{ height: `${Math.max(4, (d.total / maxHarian) * 100)}%` }} />
                <div className="collbl">{HARI[new Date(d.tanggal).getDay()]}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="p-title">Belum terjawab</div>
          <div className="text-muted mb-3" style={{ fontSize: 12 }}>
            Insight: materi yang perlu ditambahkan
          </div>
          {stats.pertanyaanBelumTersedia.length === 0 ? (
            <p className="text-muted"><i className="ti ti-circle-check" /> Belum ada pertanyaan tak terjawab.</p>
          ) : (
            stats.pertanyaanBelumTersedia.slice(0, 5).map((item) => (
              <div className="alert amber" style={{ flexDirection: 'column', gap: 2 }} key={item._id}>
                <div style={{ fontWeight: 500 }}>"{item.pertanyaan}"</div>
                <div>{item.mapel ? `Mapel: ${item.mapel} · ` : ''}{new Date(item.timestamp).toLocaleDateString('id-ID')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel mt-4">
        <div className="p-title">Pertanyaan terbaru</div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Pertanyaan</th>
                <th>Mapel</th>
                <th>Respons</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.pertanyaanTerbaru.map((item) => (
                <tr key={item._id}>
                  <td>{item.pertanyaan}</td>
                  <td>{item.mapel || '—'}</td>
                  <td>{(item.response_time / 1000).toFixed(1)}s</td>
                  <td>
                    <span className={`badge ${item.jawaban.startsWith('Maaf, materi ini belum tersedia') ? 'amber' : 'teal'}`}>
                      {item.jawaban.startsWith('Maaf, materi ini belum tersedia') ? 'Belum ada' : 'Terjawab'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
