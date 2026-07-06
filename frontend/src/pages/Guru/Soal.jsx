import { useEffect, useState } from 'react';
import api from '../../utils/api';

const FORM_KOSONG = {
  materi_id: '',
  pertanyaan: '',
  pilihan: ['', '', '', ''],
  jawaban_benar: 0,
  penjelasan: '',
  tingkat_kesulitan: 'sedang',
};
const HURUF = ['A', 'B', 'C', 'D'];
const WARNA_LEVEL = { mudah: 'teal', sedang: 'amber', sulit: 'red' };

export default function GuruSoal() {
  const [materiList, setMateriList] = useState([]);
  const [materiId, setMateriId] = useState('');
  const [soalList, setSoalList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_KOSONG);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [hapusTarget, setHapusTarget] = useState(null);

  useEffect(() => {
    api.get('/materi').then(({ data }) => {
      setMateriList(data);
      if (data.length > 0) setMateriId(data[0]._id);
    });
  }, []);

  async function loadSoal(id) {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get('/soal', { params: { materi_id: id } });
      setSoalList(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSoal(materiId);
  }, [materiId]);

  function handleTambahBaru() {
    setForm({ ...FORM_KOSONG, materi_id: materiId });
    setEditId(null);
    setShowForm(true);
    setError('');
  }

  function handleEdit(s) {
    setForm({
      materi_id: s.materi_id,
      pertanyaan: s.pertanyaan,
      pilihan: [...s.pilihan],
      jawaban_benar: s.jawaban_benar,
      penjelasan: s.penjelasan || '',
      tingkat_kesulitan: s.tingkat_kesulitan,
    });
    setEditId(s._id);
    setShowForm(true);
    setError('');
  }

  async function handleHapus() {
    await api.delete(`/soal/${hapusTarget._id}`);
    setHapusTarget(null);
    loadSoal(materiId);
  }

  function handleUbahPilihan(idx, value) {
    const pilihanBaru = [...form.pilihan];
    pilihanBaru[idx] = value;
    setForm({ ...form, pilihan: pilihanBaru });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.pilihan.some((p) => !p.trim())) {
      setError('Semua 4 pilihan jawaban wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        await api.put(`/soal/${editId}`, form);
      } else {
        await api.post('/soal', form);
      }
      setShowForm(false);
      loadSoal(materiId);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan soal');
    } finally {
      setSaving(false);
    }
  }

  if (showForm) {
    return (
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="breadcrumb">
          <a onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }}>
            Kelola soal
          </a>{' '}
          · {editId ? 'Edit soal' : 'Tambah soal'}
        </div>
        <div className="mb-4" style={{ fontSize: 18, fontWeight: 500 }}>
          {editId ? 'Edit soal' : 'Tambah soal baru'}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Pertanyaan</label>
            <textarea
              rows={3}
              placeholder="Tulis pertanyaan..."
              value={form.pertanyaan}
              onChange={(e) => setForm({ ...form, pertanyaan: e.target.value })}
              required
            />
          </div>

          <div className="field">
            <label>Pilihan jawaban</label>
            <div className="flex" style={{ flexDirection: 'column', gap: 8 }}>
              {form.pilihan.map((p, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="benar"
                    style={{ width: 'auto' }}
                    checked={form.jawaban_benar === idx}
                    onChange={() => setForm({ ...form, jawaban_benar: idx })}
                  />
                  <div className="opt-l">{HURUF[idx]}</div>
                  <input
                    type="text"
                    placeholder={`Pilihan ${HURUF[idx]}`}
                    value={p}
                    onChange={(e) => handleUbahPilihan(idx, e.target.value)}
                    required
                  />
                </div>
              ))}
            </div>
            <div className="text-muted mt-2" style={{ fontSize: 11 }}>
              Pilih radio button di samping jawaban yang benar.
            </div>
          </div>

          <div className="field">
            <label>Penjelasan jawaban</label>
            <textarea
              rows={2}
              placeholder="Jelaskan mengapa jawaban tersebut benar..."
              value={form.penjelasan}
              onChange={(e) => setForm({ ...form, penjelasan: e.target.value })}
            />
          </div>

          <div className="field" style={{ maxWidth: 200 }}>
            <label>Tingkat kesulitan</label>
            <select
              value={form.tingkat_kesulitan}
              onChange={(e) => setForm({ ...form, tingkat_kesulitan: e.target.value })}
            >
              <option value="mudah">Mudah</option>
              <option value="sedang">Sedang</option>
              <option value="sulit">Sulit</option>
            </select>
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
              {saving ? 'Menyimpan...' : 'Simpan soal'}
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
          Kelola soal
        </div>
        <button className="btn" onClick={handleTambahBaru} disabled={!materiId}>
          <i className="ti ti-plus" /> Tambah soal
        </button>
      </div>

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Pilih materi</label>
        <select value={materiId} onChange={(e) => setMateriId(e.target.value)}>
          {materiList.length === 0 && <option value="">Belum ada materi</option>}
          {materiList.map((m) => (
            <option key={m._id} value={m._id}>
              {m.judul} — {m.mapel} Kelas {m.kelas}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-muted">Memuat soal...</p>
      ) : soalList.length === 0 ? (
        <p className="text-muted">Belum ada soal untuk materi ini.</p>
      ) : (
        soalList.map((s, i) => (
          <div className="panel mb-3" key={s._id}>
            <div className="flex justify-between gap-3">
              <div className="flex-1">
                <div className="text-muted mb-2" style={{ fontSize: 11 }}>
                  Soal {i + 1} ·{' '}
                  <span style={{ color: `var(--${WARNA_LEVEL[s.tingkat_kesulitan] || 'amber'})` }}>
                    {s.tingkat_kesulitan}
                  </span>
                </div>
                <div className="row-name mb-2">{s.pertanyaan}</div>
                <div className="text-2" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {s.pilihan.map((opsi, idx) => (
                    <span key={idx} style={{ marginRight: 12 }}>
                      {idx === s.jawaban_benar ? (
                        <span style={{ color: 'var(--teal)', fontWeight: 500 }}>
                          {HURUF[idx]}. {opsi} ✓
                        </span>
                      ) : (
                        `${HURUF[idx]}. ${opsi}`
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost" style={{ padding: '5px 9px' }} onClick={() => handleEdit(s)}>
                  <i className="ti ti-edit" />
                </button>
                <button
                  className="btn danger"
                  style={{ padding: '5px 9px', marginLeft: 6 }}
                  onClick={() => setHapusTarget(s)}
                >
                  <i className="ti ti-trash" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {hapusTarget && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-title">Hapus soal?</div>
            <div className="modal-text">Soal ini akan dihapus permanen dan tidak bisa dikembalikan.</div>
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
