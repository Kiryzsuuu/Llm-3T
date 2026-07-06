import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';

const HARI_TIDAK_AKTIF = 7;

function hitungPersen(m) {
  if (!m.total_soal_dikerjakan) return 0;
  return Math.round((m.total_soal_benar / m.total_soal_dikerjakan) * 100);
}

function hariSejak(tanggal) {
  if (!tanggal) return Infinity;
  return Math.floor((Date.now() - new Date(tanggal).getTime()) / (1000 * 60 * 60 * 24));
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
    <div className="container">
      <div className="hero purple">
        <div className="hero-left">
          <div className="hero-avatar">{(user?.nama || '?').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="hero-hi">Dashboard guru</div>
            <div className="hero-name">
              {user?.nama} {user?.sekolah ? `· ${user.sekolah}` : ''}
            </div>
          </div>
        </div>
        <div className="hero-pill">
          <i className="ti ti-users" style={{ color: '#CECBF6' }} />
          <span className="hero-num">{stats.totalMurid}</span>
          <span className="hero-lbl">
            murid
            <br />
            aktif
          </span>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--teal-bg)' }}>
            <i className="ti ti-trending-up" style={{ color: 'var(--teal)' }} />
          </div>
          <div className="stat-v">{stats.rataRata}%</div>
          <div className="stat-l">Rata-rata skor</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--blue-bg)' }}>
            <i className="ti ti-books" style={{ color: 'var(--blue)' }} />
          </div>
          <div className="stat-v">{murid.reduce((s, m) => s + (m.total_materi || 0), 0)}</div>
          <div className="stat-l">Total materi dikerjakan</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--red-bg)' }}>
            <i className="ti ti-alert-circle" style={{ color: 'var(--red)' }} />
          </div>
          <div className="stat-v">{stats.tidakAktif.length}</div>
          <div className="stat-l">Murid perlu perhatian</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="p-title">Progress murid</div>
          {loading ? (
            <p className="text-muted">Memuat data...</p>
          ) : murid.length === 0 ? (
            <p className="text-muted">Belum ada data murid.</p>
          ) : (
            murid.slice(0, 6).map((m) => {
              const persen = hitungPersen(m);
              return (
                <div className="row" key={m.murid_id}>
                  <div className="row-av" style={{ background: 'var(--teal-bg)', color: 'var(--teal)' }}>
                    {(m.nama || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="row-name">{m.nama}</div>
                    <div className="row-sub">
                      Kelas {m.kelas} ·{' '}
                      {hariSejak(m.last_accessed) === 0
                        ? 'aktif hari ini'
                        : Number.isFinite(hariSejak(m.last_accessed))
                        ? `aktif ${hariSejak(m.last_accessed)} hari lalu`
                        : 'belum pernah aktif'}
                    </div>
                  </div>
                  <div className="row-right">
                    <div className="row-pct" style={{ color: warnaTeks(persen) }}>
                      {persen}%
                    </div>
                    <div className="row-bar">
                      <div className={kelasBar(persen)} style={{ width: `${persen}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="panel">
          <div className="p-title">Perlu tindakan</div>
          {stats.tidakAktif.length === 0 ? (
            <p className="text-muted"><i className="ti ti-circle-check" /> Semua murid aktif belajar.</p>
          ) : (
            stats.tidakAktif.map((m) => (
              <div className="alert red" key={m.murid_id}>
                <i className="ti ti-user-exclamation" />
                <div>
                  {m.nama} tidak aktif {hariSejak(m.last_accessed)} hari. Hubungi wali murid?
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
