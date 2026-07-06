import { useEffect, useState } from 'react';
import { syncProgressKeServer, onSyncNotifikasi } from '../utils/syncManager';

export default function StatusKoneksi() {
  const [online, setOnline] = useState(navigator.onLine);
  const [notif, setNotif] = useState(null);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      syncProgressKeServer();
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSyncNotifikasi(({ pesan, jenis }) => {
      setNotif({ pesan, jenis });
      setTimeout(() => setNotif(null), 4000);
    });
    return unsubscribe;
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <span className={`conn ${online ? '' : 'off'}`}>
        <span className="dot" />
        {online ? 'Terhubung' : 'Offline'}
      </span>

      {notif && (
        <div
          className="badge"
          style={{
            position: 'absolute',
            right: 0,
            top: 28,
            zIndex: 20,
            width: 200,
            whiteSpace: 'normal',
            background: notif.jenis === 'success' ? 'var(--teal)' : 'var(--red)',
            color: '#fff',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,.15)',
          }}
        >
          {notif.pesan}
        </div>
      )}
    </div>
  );
}
