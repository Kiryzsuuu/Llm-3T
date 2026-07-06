import { useState } from 'react';
import api from '../utils/api';

export default function UbahPassword() {
  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [error, setError] = useState('');
  const [sukses, setSukses] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSukses('');

    if (passwordBaru !== konfirmasiPassword) {
      setError('Konfirmasi password baru tidak cocok');
      return;
    }
    if (passwordBaru.length < 6) {
      setError('Password baru minimal 6 karakter');
      return;
    }

    setLoading(true);
    try {
      await api.put('/auth/password', { passwordLama, passwordBaru });
      setSukses('Password berhasil diubah.');
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <div className="mb-4">
        <div style={{ fontSize: 18, fontWeight: 500 }}>Ubah Password</div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Perbarui password akunmu secara berkala untuk keamanan.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="panel">
        <div className="field">
          <label>Password Lama</label>
          <input type="password" value={passwordLama} onChange={(e) => setPasswordLama(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password Baru</label>
          <input
            type="password"
            value={passwordBaru}
            onChange={(e) => setPasswordBaru(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="field">
          <label>Konfirmasi Password Baru</label>
          <input
            type="password"
            value={konfirmasiPassword}
            onChange={(e) => setKonfirmasiPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error && (
          <div className="alert red mb-3">
            <i className="ti ti-alert-circle" />
            <div>{error}</div>
          </div>
        )}
        {sukses && (
          <div className="alert blue mb-3">
            <i className="ti ti-circle-check" />
            <div>{sukses}</div>
          </div>
        )}

        <button type="submit" className="btn big" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
        </button>
      </form>

      <p className="text-center text-muted mt-3" style={{ fontSize: 12 }}>
        Lupa password akun ini? Hubungi admin/operator sekolah untuk direset.
      </p>
    </div>
  );
}
