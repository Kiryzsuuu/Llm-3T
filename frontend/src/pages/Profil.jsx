import { useState } from 'react';
import api from '../utils/api';
import { getUser, updateUser, getRole } from '../utils/auth';

const LABEL_ROLE = { murid: 'Murid', guru: 'Guru', admin: 'Admin' };

function inisialNama(nama) {
  if (!nama) return '?';
  const kata = nama.trim().split(/\s+/);
  return (kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)).toUpperCase();
}

export default function Profil() {
  const role = getRole();
  const userTersimpan = getUser();

  const [form, setForm] = useState({
    nama: userTersimpan?.nama || '',
    email: userTersimpan?.email || '',
    sekolah: userTersimpan?.sekolah || '',
    kelas: userTersimpan?.kelas || '',
  });
  const [errorProfil, setErrorProfil] = useState('');
  const [suksesProfil, setSuksesProfil] = useState('');
  const [savingProfil, setSavingProfil] = useState(false);

  const [passwordLama, setPasswordLama] = useState('');
  const [passwordBaru, setPasswordBaru] = useState('');
  const [konfirmasiPassword, setKonfirmasiPassword] = useState('');
  const [errorPassword, setErrorPassword] = useState('');
  const [suksesPassword, setSuksesPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSubmitProfil(e) {
    e.preventDefault();
    setErrorProfil('');
    setSuksesProfil('');
    setSavingProfil(true);
    try {
      const { data } = await api.put('/auth/profile', form);
      updateUser({ id: data.id, nama: data.nama, email: data.email, role: data.role, sekolah: data.sekolah, kelas: data.kelas });
      setSuksesProfil('Profil berhasil diperbarui.');
    } catch (err) {
      setErrorProfil(err.response?.data?.message || 'Gagal memperbarui profil');
    } finally {
      setSavingProfil(false);
    }
  }

  async function handleSubmitPassword(e) {
    e.preventDefault();
    setErrorPassword('');
    setSuksesPassword('');

    if (passwordBaru !== konfirmasiPassword) {
      setErrorPassword('Konfirmasi password baru tidak cocok');
      return;
    }
    if (passwordBaru.length < 6) {
      setErrorPassword('Password baru minimal 6 karakter');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/auth/password', { passwordLama, passwordBaru });
      setSuksesPassword('Password berhasil diubah.');
      setPasswordLama('');
      setPasswordBaru('');
      setKonfirmasiPassword('');
    } catch (err) {
      setErrorPassword(err.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="avatar" style={{ width: 48, height: 48, fontSize: 15 }}>
          {inisialNama(form.nama)}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Profil Saya</div>
          <span className="badge teal">{LABEL_ROLE[role] || role}</span>
        </div>
      </div>

      <form onSubmit={handleSubmitProfil} className="panel mb-4">
        <div className="p-title">Informasi Akun</div>

        <div className="field">
          <label>Nama lengkap</label>
          <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
        </div>
        <div className="field">
          <label>Email (dipakai untuk login)</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label>Sekolah</label>
          <input type="text" value={form.sekolah} onChange={(e) => setForm({ ...form, sekolah: e.target.value })} />
        </div>
        {role === 'murid' && (
          <div className="field">
            <label>Kelas</label>
            <input type="text" value={form.kelas} onChange={(e) => setForm({ ...form, kelas: e.target.value })} />
          </div>
        )}

        {errorProfil && (
          <div className="alert red mb-3">
            <i className="ti ti-alert-circle" />
            <div>{errorProfil}</div>
          </div>
        )}
        {suksesProfil && (
          <div className="alert blue mb-3">
            <i className="ti ti-circle-check" />
            <div>{suksesProfil}</div>
          </div>
        )}

        <button type="submit" className="btn big" disabled={savingProfil}>
          {savingProfil ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </form>

      <form onSubmit={handleSubmitPassword} className="panel">
        <div className="p-title">Ubah Password</div>

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

        {errorPassword && (
          <div className="alert red mb-3">
            <i className="ti ti-alert-circle" />
            <div>{errorPassword}</div>
          </div>
        )}
        {suksesPassword && (
          <div className="alert blue mb-3">
            <i className="ti ti-circle-check" />
            <div>{suksesPassword}</div>
          </div>
        )}

        <button type="submit" className="btn big" disabled={savingPassword}>
          {savingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}
        </button>
      </form>

      <p className="text-center text-muted mt-3" style={{ fontSize: 12 }}>
        Lupa password akun ini? Hubungi admin/operator sekolah untuk direset.
      </p>
    </div>
  );
}
