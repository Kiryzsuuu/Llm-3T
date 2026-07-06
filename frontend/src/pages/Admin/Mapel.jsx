import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { WARNA_HEX, BG_HEX } from '../../utils/mapelStyle';

const FORM_KOSONG = { nama: '', icon: 'ti-book', warna: 'teal', jenjang: ['SD', 'SMP', 'SMA'] };
const PILIHAN_WARNA = ['teal', 'blue', 'amber', 'purple', 'red'];
const PILIHAN_ICON = [
  'ti-book', 'ti-flask', 'ti-math-symbols', 'ti-world', 'ti-language', 'ti-flag',
  'ti-book-2', 'ti-atom', 'ti-palette', 'ti-run', 'ti-music', 'ti-device-desktop-analytics',
];

export default function AdminMapel() {
  const [mapelList, setMapelList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/mapel');
      setMapelList(data);
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

  function handleEdit(m) {
    setForm({ nama: m.nama, icon: m.icon, warna: m.warna, jenjang: m.jenjang });
    setEditId(m._id);
    setShowForm(true);
    setError('');
  }

  async function handleHapus() {
    try {
      await api.delete(`/mapel/${hapusTarget._id}`);
      setHapusTarget(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus mata pelajaran');
    }
  }

  function toggleJenjang(j) {
    setForm((f) => ({
      ...f,
      jenjang: f.jenjang.includes(j) ? f.jenjang.filter((x) => x !== j) : [...f.jenjang, j],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/mapel/${editId}`, form);
      } else {
        await api.post('/mapel', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan mata pelajaran');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container">
      <div className="sec-head mb-4">
        <div className="sec-title" style={{ fontSize: 17 }}>
          Kelola mata pelajaran
        </div>
        <button className="btn" onClick={handleTambahBaru}>
          <i className="ti ti-plus" /> Tambah mapel
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel mb-4">
          <div className="p-title">{editId ? 'Edit mata pelajaran' : 'Mata pelajaran baru'}</div>

          <div className="field">
            <label>Nama mata pelajaran</label>
            <input
              type="text"
              placeholder="mis. Seni Budaya"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label>Jenjang yang memakai mapel ini</label>
            <div className="flex gap-2">
              {['SD', 'SMP', 'SMA'].map((j) => (
                <div
                  key={j}
                  className={`chip ${form.jenjang.includes(j) ? 'active' : ''}`}
                  onClick={() => toggleJenjang(j)}
                >
                  {j}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Warna</label>
            <div className="flex gap-2">
              {PILIHAN_WARNA.map((w) => (
                <div
                  key={w}
                  onClick={() => setForm({ ...form, warna: w })}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: BG_HEX[w],
                    border: form.warna === w ? `2px solid ${WARNA_HEX[w]}` : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <label>Ikon</label>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {PILIHAN_ICON.map((ic) => (
                <div
                  key={ic}
                  onClick={() => setForm({ ...form, icon: ic })}
                  className="mp-ico"
                  style={{
                    background: form.icon === ic ? BG_HEX[form.warna] : 'var(--soft)',
                    cursor: 'pointer',
                    border: form.icon === ic ? `1.5px solid ${WARNA_HEX[form.warna]}` : '1px solid transparent',
                  }}
                >
                  <i className={`ti ${ic}`} style={{ color: form.icon === ic ? WARNA_HEX[form.warna] : 'var(--muted)' }} />
                </div>
              ))}
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
              {saving ? 'Menyimpan...' : 'Simpan mapel'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Memuat mata pelajaran...</p>
      ) : mapelList.length === 0 ? (
        <p className="text-muted">Belum ada mata pelajaran. Tambahkan yang pertama.</p>
      ) : (
        <div className="mapel-grid">
          {mapelList.map((m) => (
            <div className="mp" key={m._id} style={{ cursor: 'default' }}>
              <div className="mp-top">
                <div className="mp-ico" style={{ background: BG_HEX[m.warna] }}>
                  <i className={`ti ${m.icon}`} style={{ color: WARNA_HEX[m.warna] }} />
                </div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => handleEdit(m)}>
                    <i className="ti ti-edit" />
                  </button>
                  <button
                    className="btn danger"
                    style={{ padding: '4px 8px', marginLeft: 4 }}
                    onClick={() => setHapusTarget(m)}
                  >
                    <i className="ti ti-trash" />
                  </button>
                </div>
              </div>
              <div className="mp-name">{m.nama}</div>
              <div className="mp-sub">{m.jenjang.join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {hapusTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Hapus mata pelajaran?</div>
            <div className="modal-text">
              "{hapusTarget.nama}" akan dihapus. Materi/soal yang sudah memakai nama ini tidak ikut terhapus.
            </div>
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
