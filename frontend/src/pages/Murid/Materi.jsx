import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { cacheMateri, isMateriOffline } from '../../utils/offlineCache';
import { getAllItems } from '../../utils/localDB';
import { gayaMapel, WARNA_HEX, BG_HEX } from '../../utils/mapelStyle';

export default function MuridMateri() {
  const navigate = useNavigate();
  const [materi, setMateri] = useState([]);
  const [offlineIds, setOfflineIds] = useState(new Set());
  const [mapelAktif, setMapelAktif] = useState('semua');
  const [cari, setCari] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/materi');
        setMateri(data);
        await cacheMateri(data);

        const status = await Promise.all(data.map((m) => isMateriOffline(m._id)));
        setOfflineIds(new Set(data.filter((_, i) => status[i]).map((m) => m._id)));
      } catch (err) {
        setMateri(await getAllItems('materi'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const mapelList = useMemo(() => ['semua', ...new Set(materi.map((m) => m.mapel))], [materi]);

  const materiTampil = materi.filter((m) => {
    const cocokMapel = mapelAktif === 'semua' || m.mapel === mapelAktif;
    const cocokCari = !cari || m.judul.toLowerCase().includes(cari.toLowerCase());
    return cocokMapel && cocokCari;
  });

  return (
    <div className="container">
      <div className="sec-head mb-4">
        <div className="sec-title" style={{ fontSize: 17 }}>
          Semua materi
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <i className="ti ti-search" />
          <input type="text" placeholder="Cari materi..." value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
      </div>

      <div className="chips">
        {mapelList.map((mapel) => (
          <div
            key={mapel}
            className={`chip ${mapelAktif === mapel ? 'active' : ''}`}
            onClick={() => setMapelAktif(mapel)}
          >
            {mapel === 'semua' ? 'Semua' : mapel}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Memuat materi...</p>
      ) : materiTampil.length === 0 ? (
        <p className="text-muted">Belum ada materi tersedia.</p>
      ) : (
        <div>
          {materiTampil.map((m) => {
            const { icon, warna } = gayaMapel(m.mapel);
            const offline = offlineIds.has(m._id);
            return (
              <div
                key={m._id}
                className="panel mb-3"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/murid/materi/${m._id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="mp-ico" style={{ background: BG_HEX[warna], width: 40, height: 40 }}>
                    <i className={`ti ${icon}`} style={{ color: WARNA_HEX[warna] }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="row-name">{m.judul}</div>
                      {offline && (
                        <span className="badge teal">
                          <i className="ti ti-download" style={{ fontSize: 11 }} /> Offline
                        </span>
                      )}
                    </div>
                    <div className="row-sub">
                      {m.mapel} · {m.jenjang} · Kelas {m.kelas}
                      {m.bab ? ` · ${m.bab}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
