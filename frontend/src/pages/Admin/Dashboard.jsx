import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';

function MenuCard({ to, icon, warna, title, desc }) {
  const navigate = useNavigate();
  return (
    <div className="menu-card" onClick={() => navigate(to)}>
      <i className={`ti ${icon}`} style={{ color: `var(--${warna})` }} />
      <div className="t">{title}</div>
      <div className="s">{desc}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const user = getUser();
  const [stats, setStats] = useState({ totalMurid: 0, totalGuru: 0, totalAdmin: 0, totalMateri: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [{ data: users }, { data: materi }] = await Promise.all([api.get('/users'), api.get('/materi')]);
        setStats({
          totalMurid: users.filter((u) => u.role === 'murid').length,
          totalGuru: users.filter((u) => u.role === 'guru').length,
          totalAdmin: users.filter((u) => u.role === 'admin').length,
          totalMateri: materi.length,
        });
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="container">
      <div className="hero purple">
        <div className="hero-left">
          <div className="hero-avatar">{(user?.nama || 'AD').slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="hero-hi">Pusat kendali</div>
            <div className="hero-name">{user?.nama || 'Admin'} · Tim Pusat EduNusa</div>
          </div>
        </div>
      </div>

      <div className="stats four">
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--teal-bg)' }}>
            <i className="ti ti-users" style={{ color: 'var(--teal)' }} />
          </div>
          <div className="stat-v">{loading ? '...' : stats.totalMurid}</div>
          <div className="stat-l">Murid</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--blue-bg)' }}>
            <i className="ti ti-chalkboard" style={{ color: 'var(--blue)' }} />
          </div>
          <div className="stat-v">{loading ? '...' : stats.totalGuru}</div>
          <div className="stat-l">Guru</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--purple-bg)' }}>
            <i className="ti ti-shield" style={{ color: 'var(--purple)' }} />
          </div>
          <div className="stat-v">{loading ? '...' : stats.totalAdmin}</div>
          <div className="stat-l">Admin</div>
        </div>
        <div className="stat">
          <div className="stat-ico" style={{ background: 'var(--amber-bg)' }}>
            <i className="ti ti-books" style={{ color: 'var(--amber)' }} />
          </div>
          <div className="stat-v">{loading ? '...' : stats.totalMateri}</div>
          <div className="stat-l">Materi</div>
        </div>
      </div>

      <div className="sec-head">
        <div className="sec-title">Kelola</div>
      </div>
      <div className="menu-grid">
        <MenuCard to="/admin/users" icon="ti-users-group" warna="teal" title="Kelola pengguna" desc="Murid, guru, admin" />
        <MenuCard to="/guru/materi" icon="ti-books" warna="amber" title="Kelola materi" desc="Konten kurikulum" />
        <MenuCard to="/guru/bank-materi" icon="ti-database" warna="teal" title="Bank Materi" desc="Perpustakaan materi siap pakai" />
        <MenuCard to="/guru/soal" icon="ti-list-check" warna="blue" title="Kelola soal" desc="Bank soal latihan" />
        <MenuCard to="/admin/mapel" icon="ti-category" warna="purple" title="Mata pelajaran" desc="Kategori & jenjang" />
        <MenuCard to="/guru/murid" icon="ti-chart-bar" warna="teal" title="Progress murid" desc="Pantau semua sekolah" />
        <MenuCard to="/admin/edunusa" icon="ti-sparkles" warna="purple" title="EduNusa" desc="Statistik AI Tutor" />
        <MenuCard to="/admin/latih-ai" icon="ti-brain" warna="blue" title="Latih AI" desc="Dataset & fine-tuning" />
      </div>
    </div>
  );
}
