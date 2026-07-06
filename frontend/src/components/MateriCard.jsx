import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import { gayaMapel, WARNA_HEX, BG_HEX } from '../utils/mapelStyle';

export default function MateriCard({ materi, persenProgress }) {
  const { icon, warna } = gayaMapel(materi.mapel);

  return (
    <Link to={`/murid/materi/${materi._id}`} className="mp">
      <div className="mp-top">
        <div className="mp-ico" style={{ background: BG_HEX[warna] }}>
          <i className={`ti ${icon}`} style={{ color: WARNA_HEX[warna] }} />
        </div>
        {typeof persenProgress === 'number' && (
          <span className="mp-pct" style={{ color: WARNA_HEX[warna] }}>
            {Math.round(persenProgress)}%
          </span>
        )}
      </div>
      <div className="mp-name">{materi.judul}</div>
      <div className="mp-sub">
        {materi.mapel} · {materi.jenjang} · Kelas {materi.kelas}
      </div>
      {typeof persenProgress === 'number' && (
        <div className="bar">
          <div style={{ width: `${Math.round(persenProgress)}%`, background: `var(--${warna}-acc)` }} />
        </div>
      )}
    </Link>
  );
}
