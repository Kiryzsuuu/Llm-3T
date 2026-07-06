import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';

function hitungPersen(m) {
  if (!m.total_soal_dikerjakan) return 0;
  return Math.round((m.total_soal_benar / m.total_soal_dikerjakan) * 100);
}
function kelasBar(persen) {
  if (persen > 80) return 'hi';
  if (persen >= 50) return 'md';
  if (persen >= 30) return 'lo';
  return 'cr';
}
function warnaTeks(persen) {
  if (persen > 80) return 'var(--teal)';
  if (persen >= 50) return 'var(--blue)';
  if (persen >= 30) return 'var(--amber)';
  return 'var(--red)';
}
function labelAktif(tanggal) {
  if (!tanggal) return 'belum pernah';
  const hari = Math.floor((Date.now() - new Date(tanggal).getTime()) / (1000 * 60 * 60 * 24));
  if (hari === 0) return 'Hari ini';
  if (hari === 1) return 'Kemarin';
  return `${hari} hari lalu`;
}

export default function GuruMurid() {
  const user = getUser();
  const [murid, setMurid] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');
  const [kelasAktif, setKelasAktif] = useState('semua');

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

  const daftarKelas = useMemo(() => ['semua', ...new Set(murid.map((m) => m.kelas).filter(Boolean))], [murid]);

  const muridTampil = murid.filter((m) => {
    const cocokKelas = kelasAktif === 'semua' || String(m.kelas) === String(kelasAktif);
    const cocokCari = !cari || m.nama.toLowerCase().includes(cari.toLowerCase());
    return cocokKelas && cocokCari;
  });

  return (
    <div className="container">
      <div className="sec-head mb-4">
        <div className="sec-title" style={{ fontSize: 17 }}>
          Daftar murid
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Cari nama murid..." value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        <select style={{ width: 'auto' }} value={kelasAktif} onChange={(e) => setKelasAktif(e.target.value)}>
          {daftarKelas.map((k) => (
            <option key={k} value={k}>
              {k === 'semua' ? 'Semua kelas' : `Kelas ${k}`}
            </option>
          ))}
        </select>
      </div>

      <div className="panel tbl-wrap" style={{ padding: '6px 16px' }}>
        {loading ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Memuat data...
          </p>
        ) : muridTampil.length === 0 ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Tidak ada murid ditemukan.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Murid</th>
                <th>Kelas</th>
                <th>Terakhir aktif</th>
                <th style={{ width: 160 }}>Progress</th>
              </tr>
            </thead>
            <tbody>
              {muridTampil.map((m) => {
                const persen = hitungPersen(m);
                return (
                  <tr key={m.murid_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="row-av" style={{ background: 'var(--teal-bg)', color: 'var(--teal)' }}>
                          {(m.nama || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="row-name">{m.nama}</span>
                      </div>
                    </td>
                    <td>{m.kelas}</td>
                    <td>{labelAktif(m.last_accessed)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="row-bar" style={{ flex: 1 }}>
                          <div className={kelasBar(persen)} style={{ width: `${persen}%` }} />
                        </div>
                        <span style={{ fontSize: 12, color: warnaTeks(persen), fontWeight: 500 }}>{persen}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
