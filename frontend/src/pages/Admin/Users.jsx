import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { getUser } from '../../utils/auth';

const FORM_KOSONG = { nama: '', email: '', password: '', role: 'murid', sekolah: '', kelas: '' };
const WARNA_ROLE = { murid: 'teal', guru: 'blue', admin: 'purple' };
const LABEL_ROLE = { murid: 'Murid', guru: 'Guru', admin: 'Admin' };

export default function AdminUsers() {
  const currentUser = getUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');
  const [roleAktif, setRoleAktif] = useState('semua');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleTambahBaru() {
    setForm(FORM_KOSONG);
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function handleEdit(u) {
    setForm({ nama: u.nama, email: u.email, password: '', role: u.role, sekolah: u.sekolah || '', kelas: u.kelas || '' });
    setEditId(u._id);
    setShowForm(true);
    setError('');
  }

  async function handleHapus() {
    try {
      await api.delete(`/users/${hapusTarget._id}`);
      setHapusTarget(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus pengguna');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editId}`, payload);
      } else {
        if (!form.password) throw { response: { data: { message: 'Password wajib diisi untuk pengguna baru' } } };
        await api.post('/users', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan pengguna');
    } finally {
      setSaving(false);
    }
  }

  const usersTampil = users.filter((u) => {
    const cocokRole = roleAktif === 'semua' || u.role === roleAktif;
    const cocokCari =
      !cari || u.nama.toLowerCase().includes(cari.toLowerCase()) || u.email.toLowerCase().includes(cari.toLowerCase());
    return cocokRole && cocokCari;
  });

  if (showForm) {
    return (
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="breadcrumb">
          <a onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }}>
            Kelola pengguna
          </a>{' '}
          · {editId ? 'Edit pengguna' : 'Tambah pengguna'}
        </div>
        <div className="mb-4" style={{ fontSize: 18, fontWeight: 500 }}>
          {editId ? 'Edit pengguna' : 'Pengguna baru'}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nama</label>
            <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label>{editId ? 'Password baru (kosongkan jika tidak diubah)' : 'Password'}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="murid">Murid</option>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="field">
              <label>Sekolah</label>
              <input type="text" value={form.sekolah} onChange={(e) => setForm({ ...form, sekolah: e.target.value })} />
            </div>
            <div className="field">
              <label>Kelas</label>
              <input type="text" value={form.kelas} onChange={(e) => setForm({ ...form, kelas: e.target.value })} />
            </div>
          </div>

          {error && (
            <div className="alert red mb-3">
              <i className="ti ti-alert-circle" />
              <div>{error}</div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>
              Batal
            </button>
            <button type="submit" className="btn" style={{ flex: 2 }} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="sec-head mb-4">
        <div className="sec-title" style={{ fontSize: 17 }}>
          Kelola pengguna
        </div>
        <button className="btn" onClick={handleTambahBaru}>
          <i className="ti ti-user-plus" /> Tambah pengguna
        </button>
      </div>

      <div className="toolbar">
        <div className="search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Cari nama atau email..." value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
      </div>
      <div className="chips">
        {['semua', 'murid', 'guru', 'admin'].map((r) => (
          <div key={r} className={`chip ${roleAktif === r ? 'active' : ''}`} onClick={() => setRoleAktif(r)}>
            {r === 'semua' ? 'Semua' : LABEL_ROLE[r]}
          </div>
        ))}
      </div>

      <div className="panel tbl-wrap" style={{ padding: '6px 16px' }}>
        {loading ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Memuat pengguna...
          </p>
        ) : usersTampil.length === 0 ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Tidak ada pengguna ditemukan.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Sekolah</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usersTampil.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="row-av" style={{ background: `var(--${WARNA_ROLE[u.role]}-bg)`, color: `var(--${WARNA_ROLE[u.role]})` }}>
                        {u.nama.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="row-name">{u.nama}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${WARNA_ROLE[u.role]}`}>{LABEL_ROLE[u.role]}</span>
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{u.sekolah || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '5px 9px' }} onClick={() => handleEdit(u)}>
                      <i className="ti ti-edit" />
                    </button>
                    {u._id !== currentUser?.id && (
                      <button
                        className="btn ghost"
                        style={{ padding: '5px 9px', marginLeft: 6 }}
                        onClick={() => setHapusTarget(u)}
                      >
                        <i className="ti ti-user-off" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hapusTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Hapus pengguna?</div>
            <div className="modal-text">"{hapusTarget.nama}" akan dihapus permanen dan tidak bisa dikembalikan.</div>
            <div className="flex gap-3">
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setHapusTarget(null)}>
                Batal
              </button>
              <button className="btn danger" style={{ flex: 1 }} onClick={handleHapus}>
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
