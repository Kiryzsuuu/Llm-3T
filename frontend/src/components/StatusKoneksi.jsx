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
    <div className="relative">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
        {online ? 'Online' : 'Offline'}
      </span>

      {notif && (
        <div
          className={`absolute right-0 top-8 z-20 w-56 rounded-lg px-3 py-2 text-xs shadow-lg ${
            notif.jenis === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {notif.pesan}
        </div>
      )}
    </div>
  );
}
