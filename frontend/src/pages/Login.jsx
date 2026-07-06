import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { saveSession, isLoggedIn, getRole } from '../utils/auth';

const HOME_BY_ROLE = {
  murid: '/murid/dashboard',
  guru: '/guru/dashboard',
  admin: '/admin',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Kalau sudah login, jangan tampilkan form login lagi — langsung arahkan ke dashboard masing-masing.
  if (isLoggedIn()) {
    return <Navigate to={HOME_BY_ROLE[getRole()] || '/login'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      saveSession(data.token, data.user);
      navigate(HOME_BY_ROLE[data.user.role] || '/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal masuk');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="flex items-center gap-3 mb-4">
          <i className="ti ti-book" style={{ fontSize: 30, color: '#1D9E75' }} />
          <span style={{ fontSize: 22, fontWeight: 500, color: '#E1F5EE' }}>EduNusa</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: '#E1F5EE', lineHeight: 1.35, maxWidth: 340 }}>
          Belajar tanpa batas, di mana saja.
        </div>
        <div style={{ fontSize: 13, color: '#9FE1CB', marginTop: 12, maxWidth: 340 }}>
          Platform edukasi offline-first untuk daerah Terdepan, Terluar, dan Tertinggal Indonesia.
        </div>
      </div>

      <div className="login-form">
        <div className="login-card">
          <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Selamat datang kembali</div>
          <div className="text-muted mb-4" style={{ fontSize: 13 }}>
            Masuk untuk melanjutkan belajar
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="nama@sekolah.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Kata sandi</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="alert red mb-3">
                <i className="ti ti-alert-circle" />
                <div>{error}</div>
              </div>
            )}

            <button type="submit" className="btn big" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="text-center text-muted mt-3" style={{ fontSize: 12 }}>
            Belum punya akun? Hubungi guru atau admin sekolahmu.
          </div>
        </div>
      </div>
    </div>
  );
}
