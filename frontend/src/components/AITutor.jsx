import { useState } from 'react';
import api from '../utils/api';

export default function AITutor({ materiId, jenjang }) {
  const [pertanyaan, setPertanyaan] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!pertanyaan.trim()) return;

    setLoading(true);
    setError('');
    const pertanyaanDikirim = pertanyaan;
    setPertanyaan('');

    try {
      const { data } = await api.post('/ai/tanya', {
        pertanyaan: pertanyaanDikirim,
        materi_id: materiId,
        jenjang,
      });
      setRiwayat((prev) => [...prev, { pertanyaan: pertanyaanDikirim, ...data }]);
    } catch (err) {
      setError(err.response?.data?.message || 'AI Tutor sedang tidak tersedia. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
        <span aria-hidden>🤖</span> AI Tutor
      </h3>

      <div className="mb-3 max-h-64 space-y-3 overflow-y-auto">
        {riwayat.length === 0 && (
          <p className="text-sm text-gray-500">Tanya apa saja tentang materi ini ke AI Tutor.</p>
        )}
        {riwayat.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-none bg-brand-600 px-3 py-1.5 text-sm text-white">
              {item.pertanyaan}
            </p>
            <p className="w-fit max-w-[85%] rounded-lg rounded-bl-none bg-gray-100 px-3 py-1.5 text-sm text-gray-800">
              {item.jawaban}
            </p>
            {typeof item.confidence === 'number' && (
              <p className="text-[11px] text-gray-400">Keyakinan jawaban: {Math.round(item.confidence * 100)}%</p>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-gray-400">AI Tutor sedang berpikir...</p>}
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={pertanyaan}
          onChange={(e) => setPertanyaan(e.target.value)}
          placeholder="Tulis pertanyaanmu..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Kirim
        </button>
      </form>
    </div>
  );
}
