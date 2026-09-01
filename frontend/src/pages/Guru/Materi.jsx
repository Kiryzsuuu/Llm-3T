import { useEffect, useState } from 'react';
import api from '../../utils/api';

const FORM_KOSONG = { judul: '', mapel: '', jenjang: 'SD', kelas: '', bab: '', konten: '' };

export default function GuruMateri() {
  const [materi, setMateri] = useState([]);
  const [mapelList, setMapelList] = useState([]);
  const [mapelId, setMapelId] = useState(''); // Mapel yang sedang dijelajahi - materi selalu ditampilkan di bawah 1 mapel, mencerminkan hirarki Mapel > Materi.
  const [bankMateriList, setBankMateriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);
  const [file, setFile] = useState(null);
  const [sumberMateri, setSumberMateri] = useState('baru'); // 'baru' | 'bank'
  const [bankIdDipilih, setBankIdDipilih] = useState('');
  const [infoPesan, setInfoPesan] = useState('');

  async function load(mapelUntukFilter) {
    if (!mapelUntukFilter) {
      setMateri([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/materi', { params: { mapel: mapelUntukFilter } });
      setMateri(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get('/mapel').then(({ data }) => {
      setMapelList(data);
      if (data.length > 0) setMapelId(data[0]._id);
      else setLoading(false);
    });
    api.get('/bank-materi').then(({ data }) => setBankMateriList(data));
  }, []);

  useEffect(() => {
    load(mapelId);
  }, [mapelId]);

  function handleTambahBaru() {
    setForm({ ...FORM_KOSONG, mapel: mapelId });
    setFile(null);
    setEditId(null);
    setSumberMateri('baru');
    setBankIdDipilih('');
    setShowForm(true);
    setError('');
    setInfoPesan('');
  }

  function handlePilihDariBank(id) {
    setBankIdDipilih(id);
    const item = bankMateriList.find((b) => b._id === id);
    if (!item) return;
    setForm((f) => ({ ...f, judul: item.judul, mapel: item.mapel?._id || '', jenjang: item.jenjang, bab: item.bab || '', konten: item.konten }));
    setFile(null);
  }

  function handleEdit(m) {
    setForm({ judul: m.judul, mapel: m.mapel?._id || '', jenjang: m.jenjang, kelas: m.kelas, bab: m.bab || '', konten: m.konten });
    setFile(null);
    setEditId(m._id);
    setSumberMateri('baru');
    setBankIdDipilih('');
    setShowForm(true);
    setError('');
  }

  async function handleHapus() {
    await api.delete(`/materi/${hapusTarget._id}`);
    setHapusTarget(null);
    load(mapelId);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file && !form.konten.trim()) {
      setError('Isi konten materi secara manual, atau upload file PDF/TXT/DOCX.');
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
        await api.put(`/materi/${editId}`, payload);
        setInfoPesan('');
      } else {
        // api.js meng-unwrap response.data jadi langsung isi "data" dari backend (lihat interceptor
        // di utils/api.js) - kalau upload file berisi banyak bab, backend memecahnya jadi beberapa
        // materi sekaligus (lihat pisahPerBab di backend/routes/materi.js) dan responsnya array,
        // bukan satu objek materi seperti biasa. Tunjukkan itu supaya guru/admin tahu itu bukan gagal.
        const { data } = await api.post('/materi', payload);
        setInfoPesan(
          Array.isArray(data)
            ? `File ini berisi ${data.length} bab - otomatis dipecah jadi ${data.length} materi terpisah.`
            : ''
        );
      }
      setShowForm(false);
      load(mapelId);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  }

  if (showForm) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <a onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }}>
            Kelola materi
          </a>{' '}
          · {editId ? 'Edit materi' : 'Tambah materi'}
        </div>
        <div className="mb-4" style={{ fontSize: 18, fontWeight: 500 }}>
          {editId ? 'Edit materi' : 'Tambah materi baru'}
        </div>

        {!editId && (
          <div className="field">
            <label>Sumber materi</label>
            <div className="chips" style={{ marginBottom: 8 }}>
              <div
                className={`chip ${sumberMateri === 'baru' ? 'active' : ''}`}
                onClick={() => {
                  setSumberMateri('baru');
                  setBankIdDipilih('');
                }}
              >
                <i className="ti ti-file-plus" /> Buat baru
              </div>
              <div className={`chip ${sumberMateri === 'bank' ? 'active' : ''}`} onClick={() => setSumberMateri('bank')}>
                <i className="ti ti-database" /> Pilih dari Bank Materi
              </div>
            </div>

            {sumberMateri === 'bank' && (
              <>
                <select value={bankIdDipilih} onChange={(e) => handlePilihDariBank(e.target.value)}>
                  <option value="" disabled>
                    {bankMateriList.length === 0 ? 'Bank materi masih kosong' : 'Pilih item dari bank...'}
                  </option>
                  {bankMateriList.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.judul} — {item.mapel?.nama} ({item.jenjang})
                    </option>
                  ))}
                </select>
                {bankIdDipilih && (
                  <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                    <i className="ti ti-info-circle" /> Konten disalin dari bank, silakan sesuaikan kelas dan edit isinya jika perlu.
                  </div>
                )}
              </>
            )}
          </div>
        )}

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

          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Mata pelajaran</label>
              <select value={form.mapel} onChange={(e) => setForm({ ...form, mapel: e.target.value })} required>
                <option value="" disabled>
                  Pilih mapel
                </option>
                {mapelList.map((m) => (
                  <option key={m._id} value={m._id}>
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
            <div className="field">
              <label>Kelas</label>
              <input
                type="text"
                placeholder="mis. 8"
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Bab (opsional)</label>
            <input type="text" value={form.bab} onChange={(e) => setForm({ ...form, bab: e.target.value })} />
          </div>

          <div className="field">
            <label>Upload file materi (PDF, TXT, DOCX, atau foto/scan JPG/PNG)</label>
            <input
              type="file"
              accept=".pdf,.txt,.docx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                <i className="ti ti-file-check" /> {file.name} — konten akan diambil otomatis dari file ini.
              </div>
            )}
          </div>

          <div className="field">
            <label>{file ? 'Konten materi (opsional, akan ditimpa isi file jika dikosongkan)' : 'Konten materi'}</label>
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
              {saving ? 'Menyimpan...' : 'Simpan materi'}
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
          Kelola materi
        </div>
        <button className="btn" onClick={handleTambahBaru} disabled={!mapelId}>
          <i className="ti ti-plus" /> Tambah materi
        </button>
      </div>

      {infoPesan && (
        <div className="alert blue mb-3">
          <i className="ti ti-info-circle" />
          <div>{infoPesan}</div>
        </div>
      )}

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Mata pelajaran</label>
        <select value={mapelId} onChange={(e) => setMapelId(e.target.value)}>
          {mapelList.length === 0 && <option value="">Belum ada mata pelajaran</option>}
          {mapelList.map((m) => (
            <option key={m._id} value={m._id}>
              {m.nama}
            </option>
          ))}
        </select>
      </div>

      <div className="panel tbl-wrap" style={{ padding: '6px 16px' }}>
        {!mapelId ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Buat mata pelajaran dulu di menu "Mata pelajaran" sebelum menambahkan materi.
          </p>
        ) : loading ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Memuat materi...
          </p>
        ) : materi.length === 0 ? (
          <p className="text-muted" style={{ padding: '10px 0' }}>
            Belum ada materi untuk mapel ini. Tambahkan materi baru.
          </p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kelas</th>
                <th>Bab</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {materi.map((m) => (
                <tr key={m._id}>
                  <td className="row-name">{m.judul}</td>
                  <td>{m.kelas}</td>
                  <td>{m.bab || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost" style={{ padding: '5px 9px' }} onClick={() => handleEdit(m)}>
                      <i className="ti ti-edit" />
                    </button>
                    <button
                      className="btn danger"
                      style={{ padding: '5px 9px', marginLeft: 6 }}
                      onClick={() => setHapusTarget(m)}
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
            <div className="modal-title">Hapus materi?</div>
            <div className="modal-text">"{hapusTarget.judul}" akan dihapus permanen dan tidak bisa dikembalikan.</div>
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
