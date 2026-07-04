import { useEffect, useState } from 'react';
import api from '../../utils/api';

const FORM_KOSONG = { judul: '', mapel: '', jenjang: 'SD', kelas: '', bab: '', konten: '' };

export default function GuruMateri() {
  const [materi, setMateri] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/materi');
      setMateri(data);
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
    setForm({ judul: m.judul, mapel: m.mapel, jenjang: m.jenjang, kelas: m.kelas, bab: m.bab || '', konten: m.konten });
    setEditId(m._id);
    setShowForm(true);
    setError('');
  }

  async function handleHapus(id) {
    if (!window.confirm('Hapus materi ini?')) return;
    await api.delete(`/materi/${id}`);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/materi/${editId}`, form);
      } else {
        await api.post('/materi', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Kelola Materi</h1>
        <button
          onClick={handleTambahBaru}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Materi Baru
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">{editId ? 'Edit Materi' : 'Materi Baru'}</h2>

          <input
            type="text"
            placeholder="Judul"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Mapel"
              value={form.mapel}
              onChange={(e) => setForm({ ...form, mapel: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={form.jenjang}
              onChange={(e) => setForm({ ...form, jenjang: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
            </select>
            <input
              type="text"
              placeholder="Kelas"
              value={form.kelas}
              onChange={(e) => setForm({ ...form, kelas: e.target.value })}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Bab (opsional)"
            value={form.bab}
            onChange={(e) => setForm({ ...form, bab: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Konten materi"
            value={form.konten}
            onChange={(e) => setForm({ ...form, konten: e.target.value })}
            required
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Memuat materi...</p>
      ) : materi.length === 0 ? (
        <p className="text-sm text-gray-500">Belum ada materi. Tambahkan materi baru.</p>
      ) : (
        <div className="space-y-2">
          {materi.map((m) => (
            <div key={m._id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div>
                <p className="font-medium text-gray-900">{m.judul}</p>
                <p className="text-xs text-gray-500">
                  {m.mapel} · {m.jenjang} · Kelas {m.kelas}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(m)} className="text-sm font-medium text-brand-600">
                  Edit
                </button>
                <button onClick={() => handleHapus(m._id)} className="text-sm font-medium text-red-600">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
