import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar';

export default function MateriCard({ materi, persenProgress }) {
  return (
    <Link
      to={`/murid/materi/${materi._id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md active:scale-[0.99]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-600">{materi.mapel}</p>
          <h3 className="font-semibold text-gray-900">{materi.judul}</h3>
        </div>
        <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {materi.jenjang} · Kelas {materi.kelas}
        </span>
      </div>
      {materi.bab && <p className="mb-3 text-sm text-gray-500">{materi.bab}</p>}
      {typeof persenProgress === 'number' && <ProgressBar persen={persenProgress} />}
    </Link>
  );
}
