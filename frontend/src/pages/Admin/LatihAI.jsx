import { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function AdminLatihAI() {
  const [status, setStatus] = useState(null);
  const [vectorStats, setVectorStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [hasilGenerate, setHasilGenerate] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [{ data: statusData }, { data: statsData }] = await Promise.all([
        api.get('/ai/status'),
        api.get('/ai/stats'),
      ]);
      setStatus(statusData);
      setVectorStats(statsData);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat status EduNusa');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setHasilGenerate(null);
    try {
      const { data } = await api.post('/ai/dataset/generate');
      setHasilGenerate(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menggenerate dataset');
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await api.get('/ai/dataset/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dataset-final.jsonl';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunduh dataset. Generate dataset dulu.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="sec-head mb-4">
        <div className="sec-title" style={{ fontSize: 17 }}>
          Latih EduNusa
        </div>
      </div>

      <div className="panel mb-4">
        <div className="p-title">Status model saat ini</div>
        {loading ? (
          <p className="text-muted">Memuat status...</p>
        ) : (
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="stat">
              <div className="stat-ico" style={{ background: 'var(--purple-bg)' }}>
                <i className="ti ti-sparkles" style={{ color: 'var(--purple)' }} />
              </div>
              <div className="stat-v" style={{ fontSize: 15 }}>{status?.model}</div>
              <div className="stat-l">Nama model Ollama</div>
            </div>
            <div className="stat">
              <div className="stat-ico" style={{ background: status?.status === 'online' ? 'var(--teal-bg)' : 'var(--red-bg)' }}>
                <i className={`ti ${status?.status === 'online' ? 'ti-circle-check' : 'ti-alert-circle'}`} style={{ color: status?.status === 'online' ? 'var(--teal)' : 'var(--red)' }} />
              </div>
              <div className="stat-v" style={{ fontSize: 15 }}>
                {status?.status === 'online' ? 'Aktif' : status?.status === 'model_tidak_ditemukan' ? 'Belum dibuat' : 'Offline'}
              </div>
              <div className="stat-l">Status di Ollama</div>
            </div>
            <div className="stat">
              <div className="stat-ico" style={{ background: 'var(--blue-bg)' }}>
                <i className="ti ti-database" style={{ color: 'var(--blue)' }} />
              </div>
              <div className="stat-v" style={{ fontSize: 15 }}>{vectorStats?.totalChunks ?? 0}</div>
              <div className="stat-l">Chunk materi ter-index (RAG)</div>
            </div>
          </div>
        )}
        {status?.status === 'model_tidak_ditemukan' && (
          <div className="alert amber mt-3">
            <i className="ti ti-alert-triangle" />
            <div>
              Model <code>edunusa</code> belum dibuat di Ollama. Jalankan <code>edunusa-model/setup-edunusa.sh</code> di
              server tempat Ollama berjalan.
            </div>
          </div>
        )}
      </div>

      <div className="panel mb-4">
        <div className="p-title">1. Siapkan dataset fine-tuning</div>
        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
          Menggabungkan data identitas EduNusa (<code>identity.jsonl</code>) dengan materi kurikulum yang sudah
          diunggah di <code>edunusa-model/kurikulum/</code> menjadi satu dataset siap latih.
        </p>

        <div className="flex gap-3 mb-3">
          <button className="btn" onClick={handleGenerate} disabled={generating}>
            <i className="ti ti-refresh" /> {generating ? 'Menggenerate...' : 'Generate Dataset'}
          </button>
          <button className="btn ghost" onClick={handleDownload} disabled={downloading}>
            <i className="ti ti-download" /> {downloading ? 'Mengunduh...' : 'Download dataset-final.jsonl'}
          </button>
        </div>

        {error && (
          <div className="alert red mb-3">
            <i className="ti ti-alert-circle" />
            <div>{error}</div>
          </div>
        )}

        {hasilGenerate && (
          <div className="alert blue" style={{ flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 500 }}>
              <i className="ti ti-circle-check" /> Dataset berhasil dibuat: {hasilGenerate.totalSampel} sampel
            </div>
            <div>
              Identitas: {hasilGenerate.totalIdentitas} · Materi kurikulum: {hasilGenerate.totalKurikulum}
            </div>
          </div>
        )}
      </div>

      <div className="panel mb-4">
        <div className="p-title">2. Fine-tuning di Google Colab</div>
        <p className="text-muted mb-3" style={{ fontSize: 13 }}>
          Upload <code>dataset-final.jsonl</code> yang sudah didownload ke notebook{' '}
          <code>edunusa-model/training-data/finetune-colab.ipynb</code> di Google Colab. Notebook ini akan
          melakukan fine-tuning LoRA di atas <code>gemma-2-2b</code> lalu mengekspor hasilnya ke format GGUF
          (kuantisasi Q4_K_M, ringan untuk perangkat terbatas).
        </p>
        <div className="alert blue">
          <i className="ti ti-info-circle" />
          <div>
            Buka file notebook tersebut lewat{' '}
            <a href="https://colab.research.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>
              colab.research.google.com
            </a>{' '}
            → File → Upload notebook.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="p-title">3. Pasang hasil fine-tuning ke Ollama</div>
        <ol style={{ paddingLeft: 18, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.9 }}>
          <li>Download file <code>.gguf</code> hasil training dari Colab, salin ke folder <code>edunusa-model/</code>.</li>
          <li>
            Buka <code>edunusa-model/Modelfile</code>, ganti baris <code>FROM gemma2:2b</code> menjadi{' '}
            <code>FROM ./nama-file-hasil-finetuning.gguf</code>.
          </li>
          <li>
            Jalankan ulang: <code>ollama create edunusa -f Modelfile</code>
          </li>
          <li>Refresh halaman ini untuk memastikan status model kembali "Aktif".</li>
        </ol>
      </div>
    </div>
  );
}
