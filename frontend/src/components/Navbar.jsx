import { Link, useNavigate } from 'react-router-dom';
import StatusKoneksi from './StatusKoneksi';
import { isLoggedIn, getRole, getUser, clearSession } from '../utils/auth';

export default function Navbar() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const role = getRole();
  const user = getUser();

  function handleLogout() {
    clearSession();
    navigate('/login');
  }

  const homeLink = role === 'murid' ? '/murid/dashboard' : role === 'guru' ? '/guru/dashboard' : '/login';

  return (
    <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <Link to={homeLink} className="text-base font-bold text-brand-700">
        Belajar 3T
      </Link>

      <div className="flex items-center gap-3">
        <StatusKoneksi />
        {loggedIn ? (
          <>
            <span className="hidden text-sm text-gray-600 sm:inline">{user?.nama || role}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Keluar
            </button>
          </>
        ) : (
          <Link to="/login" className="text-sm font-medium text-brand-600">
            Masuk
          </Link>
        )}
      </div>
    </nav>
  );
}
