import { Link, useLocation, useNavigate } from 'react-router-dom';
import StatusKoneksi from './StatusKoneksi';
import { isLoggedIn, getRole, getUser, clearSession } from '../utils/auth';

const MENU_BY_ROLE = {
  murid: [
    { to: '/murid/dashboard', label: 'Beranda' },
    { to: '/murid/materi', label: 'Materi' },
  ],
  guru: [
    { to: '/guru/dashboard', label: 'Dashboard' },
    { to: '/guru/murid', label: 'Murid' },
    { to: '/guru/materi', label: 'Materi' },
    { to: '/guru/bank-materi', label: 'Bank Materi' },
    { to: '/guru/soal', label: 'Soal' },
  ],
  admin: [
    { to: '/admin', label: 'Admin' },
    { to: '/admin/users', label: 'Pengguna' },
    { to: '/admin/edunusa', label: 'EduNusa' },
    { to: '/admin/latih-ai', label: 'Latih AI' },
  ],
};

const HOME_BY_ROLE = {
  murid: '/murid/dashboard',
  guru: '/guru/dashboard',
  admin: '/admin',
};

function inisialNama(nama) {
  if (!nama) return '?';
  const kata = nama.trim().split(/\s+/);
  const inisial = kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2);
  return inisial.toUpperCase();
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = isLoggedIn();
  const role = getRole();
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  const homeLink = HOME_BY_ROLE[role] || '/login';
  const menu = MENU_BY_ROLE[role] || [];
  const avatarStyle =
    role === 'guru'
      ? { background: 'var(--blue-bg)', color: 'var(--blue)' }
      : role === 'admin'
      ? { background: 'var(--purple-bg)', color: 'var(--purple)' }
      : undefined;

  if (!loggedIn) {
    return (
      <nav className="nav">
        <div className="nav-in">
          <Link to="/login" className="nav-logo">
            <i className="ti ti-book" />
            EduNusa
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="nav">
      <div className="nav-in">
        <Link to={homeLink} className="nav-logo">
          <i className="ti ti-book" />
          EduNusa
        </Link>

        <div className="nav-menu">
          {menu.map((item) => (
            <Link key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="nav-right">
          <StatusKoneksi />
          <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={handleLogout}>
            <i className="ti ti-logout" />
            Keluar
          </button>
          <Link to="/profil" title="Profil Saya" aria-label="Profil Saya">
            <div className="avatar" style={avatarStyle}>
              {inisialNama(user?.nama)}
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}
