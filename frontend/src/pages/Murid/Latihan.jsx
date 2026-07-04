import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { cacheSoal } from '../../utils/offlineCache';
import { getAllItems, simpanProgress, simpanJawaban } from '../../utils/localDB';
import { syncProgressKeServer } from '../../utils/syncManager';
import { getUser } from '../../utils/auth';

export default function Latihan() {
  const { materi_id } = useParams();
  const navigate = useNavigate();

  const [soalList, setSoalList] = useState([]);
  const [index, setIndex] = useState(0);
  const [dipilih, setDipilih] = useState(null);
  const [sudahJawab, setSudahJawab] = useState(false);
  const [skor, setSkor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/soal', { params: { materi_id } });
        setSoalList(data);
        await cacheSoal(data);
      } catch (err) {
        const cached = await getAllItems('soal');
        setSoalList(cached.filter((s) => s.materi_id === materi_id));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [materi_id]);

  const soal = soalList[index];
  const user = getUser();

  async function handlePilih(idx) {
    if (sudahJawab) return;
    setDipilih(idx);
    setSudahJawab(true);
    const benar = idx === soal.jawaban_benar;
    if (benar) {
      setSkor((s) => s + 1);
    }

    // Simpan jawaban ke IndexedDB agar tetap tercatat walau koneksi terputus di tengah latihan.
    await simpanJawaban({
      murid_id: user?.id,
      materi_id,
      soal_id: soal._id,
      jawaban: idx,
      benar,
    });
  }

  async function handleLanjut() {
    if (index + 1 < soalList.length) {
      setIndex((i) => i + 1);
      setDipilih(null);
      setSudahJawab(false);
    } else {
      setSelesai(true);
      const progressItem = {
        materi_id,
        soal_dikerjakan: soalList.length,
        soal_benar: skor,
        status: 'selesai',
      };
      try {
        await api.post('/progress', progressItem);
      } catch (err) {
        await simpanProgress(progressItem);
        syncProgressKeServer();
      }
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-500">Memuat soal...</p>;

  if (soalList.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Belum ada soal untuk materi ini.</p>
      </div>
    );
  }

  if (selesai) {
    const persen = Math.round((skor / soalList.length) * 100);
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-5xl">{persen >= 80 ? '🎉' : persen >= 50 ? '👍' : '💪'}</p>
          <h1 className="mt-3 text-xl font-bold text-gray-900">Latihan Selesai!</h1>
          <p className="mt-1 text-sm text-gray-500">
            Skor kamu: {skor} dari {soalList.length} ({persen}%)
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => navigate(`/murid/materi/${materi_id}`)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Kembali ke Materi
            </button>
            <button
              onClick={() => navigate('/murid/dashboard')}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          Soal {index + 1} dari {soalList.length}
        </span>
        <span>Skor: {skor}</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-4 font-medium text-gray-900">{soal.pertanyaan}</p>

        <div className="space-y-2">
          {soal.pilihan.map((opsi, idx) => {
            let kelas = 'border-gray-300 bg-white hover:bg-gray-50';
            if (sudahJawab) {
              if (idx === soal.jawaban_benar) kelas = 'border-green-500 bg-green-50';
              else if (idx === dipilih) kelas = 'border-red-500 bg-red-50';
              else kelas = 'border-gray-200 bg-white opacity-60';
            }

            return (
              <button
                key={idx}
                onClick={() => handlePilih(idx)}
                disabled={sudahJawab}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm ${kelas}`}
              >
                {opsi}
              </button>
            );
          })}
        </div>

        {sudahJawab && (
          <div className="mt-4 space-y-2">
            <p className={`text-sm font-semibold ${dipilih === soal.jawaban_benar ? 'text-green-600' : 'text-red-600'}`}>
              {dipilih === soal.jawaban_benar ? '✓ Jawaban benar!' : '✗ Jawaban kurang tepat'}
            </p>
            {soal.penjelasan && <p className="text-sm text-gray-600">{soal.penjelasan}</p>}
            <button
              onClick={handleLanjut}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {index + 1 < soalList.length ? 'Soal Berikutnya' : 'Selesai'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
