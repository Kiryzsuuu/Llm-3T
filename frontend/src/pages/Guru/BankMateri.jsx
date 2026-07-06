import { useEffect, useState } from 'react';
import api from '../../utils/api';

const FORM_KOSONG = { judul: '', mapel: '', jenjang: 'SD', bab: '', konten: '' };

export default function BankMateri() {
  const [bankMateri, setBankMateri] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/bank-materi');
      setBankMateri(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get('/mapel').then(({ data }) => setMapelList(data));
  }, []);

  function handleTambahBaru() {
    setForm({ ...FORM_KOSONG, mapel: mapelList[0]?.nama || '' });
    setFile(null);
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function handleEdit(item) {
    setForm({ judul: item.judul, mapel: item.mapel, jenjang: item.jenjang, bab: item.bab || '', konten: item.konten });
    setFile(null);
    setEditId(item._id);
    setShowForm(true);
    setError('');
  }

  async function handleHapus() {
    await api.delete(`/bank-materi/${hapusTarget._id}`);
    setHapusTarget(null);
    load();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file && !form.konten.trim()) {
      setError('Isi konten secara manual, atau upload file PDF/TXT/DOCX.');
      return;
    }

    setSaving(true);
    try {
      let payload = form;
      if (file) {
        payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value));
        payload.append('file', file);
      }

      if (editId) {
        await api.put(`/bank-materi/${editId}`, payload);
      } else {
        await api.post('/bank-materi', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan bank materi');
    } finally {
      setSaving(false);
    }
  }

  const itemTampil = bankMateri.filter(
    (item) => !cari || item.judul.toLowerCase().includes(cari.toLowerCase())
  );

  if (showForm) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <a onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }}>
            Bank Materi
          </a>{' '}
          · {editId ? 'Edit item' : 'Tambah item'}
        </div>
        <div className="mb-4" style={{ fontSize: 18, fontWeight: 500 }}>
          {editId ? 'Edit item bank materi' : 'Tambah item bank materi'}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Judul materi</label>
            <input
              type="text"
              placeholder="mis. Sistem Pernapasan Manusia"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              required
            />
          </div>

          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Mata pelajaran</label>
              <select value={form.mapel} onChange={(e) => setForm({ ...form, mapel: e.target.value })} required>
                <option value="" disabled>
                  Pilih mapel
                </option>
                {mapelList.map((m) => (
                  <option key={m._id} value={m.nama}>
                    {m.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Jenjang</label>
              <select value={form.jenjang} onChange={(e) => setForm({ ...form, jenjang: e.target.value })}>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="SMA">SMA</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Bab (opsional)</label>
            <input type="text" value={form.bab} onChange={(e) => setForm({ ...form, bab: e.target.value })} />
          </div>

          <div className="field">
            <label>Upload file (PDF, TXT, atau DOCX)</label>
            <input type="file" accept=".pdf,.txt,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && (
              <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                <i className="ti ti-file-check" /> {file.name} — konten akan diambil otomatis dari file ini.
              </div>
            )}
          </div>

          <div className="field">
            <label>{file ? 'Konten (opsional, akan ditimpa isi file jika dikosongkan)' : 'Konten'}</label>
            <textarea
              rows={8}
              placeholder={
                file
                  ? 'Kosongkan supaya konten diambil otomatis dari file yang di-upload...'
                  : 'Tulis atau tempel isi materi di sini, atau upload file di atas...'
              }
              value={form.konten}
              onChange={(e) => setForm({ ...form, konten: e.target.value })}
            />
          </div>

          {error && (
            <div className="alert red mb-3">
              <i className="ti ti-alert-circle" />
              <div>{error}</div>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>
              Batal
            </button>
            <button type="submit" className="btn" style={{ flex: 2 }} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan ke Bank Materi'}
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
          Bank Materi
        </div>
        <button className="btn" onClick={handleTambahBaru}>
          <i className="ti ti-plus" /> Tambah ke Bank
        </button>
      </div>
      <p className="text-muted mb-4" style={{ fontSize: 13 }}>
        Perpustakaan materi yang bisa disalin ke Kelola Materi saat membuat materi baru untuk kelas tertentu.
      </p>

      <div className="toolbar">
        <div className="search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Cari judul materi..." value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
      </div>

      <div className="panel tbl-wrap" style={{ padding: '6px 16px' }}>
        {loading ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Memuat bank materi...
          </p>
        ) : itemTampil.length === 0 ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Bank materi masih kosong. Tambahkan item pertama.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Mapel</th>
                <th>Jenjang</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itemTampil.map((item) => (
                <tr key={item._id}>
                  <td className="row-name">{item.judul}</td>
                  <td>{item.mapel}</td>
                  <td>{item.jenjang}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '5px 9px' }} onClick={() => handleEdit(item)}>
                      <i className="ti ti-edit" />
                    </button>
                    <button
                      className="btn danger"
                      style={{ padding: '5px 9px', marginLeft: 6 }}
                      onClick={() => setHapusTarget(item)}
                    >
                      <i className="ti ti-trash" />
                    </button>
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
            <div className="modal-title">Hapus dari Bank Materi?</div>
            <div className="modal-text">
              "{hapusTarget.judul}" akan dihapus dari bank. Materi yang sudah disalin ke kelas tertentu tidak ikut terhapus.
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
