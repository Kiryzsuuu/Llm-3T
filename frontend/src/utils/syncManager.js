import api from './api';
import { getProgressBelumSync, tandaiSudahSync } from './localDB';

let syncSedangBerjalan = false;
const listenerNotifikasi = new Set();

export function onSyncNotifikasi(fn) {
  listenerNotifikasi.add(fn);
  return () => listenerNotifikasi.delete(fn);
}

function beriNotifikasi(pesan, jenis = 'success') {
  listenerNotifikasi.forEach((fn) => fn({ pesan, jenis }));

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('EduNusa', { body: pesan });
  }
}

export async function syncProgressKeServer() {
  if (syncSedangBerjalan || !navigator.onLine) return;

  const belumSync = await getProgressBelumSync();
  if (belumSync.length === 0) return;

  syncSedangBerjalan = true;
  try {
    const items = belumSync.map(({ synced, updated_at, ...rest }) => rest);
    await api.post('/progress/bulk', { items });
    await tandaiSudahSync(belumSync.map((item) => item.materi_id));
    beriNotifikasi(`${items.length} progress berhasil disinkronkan.`, 'success');
  } catch (err) {
    beriNotifikasi('Gagal menyinkronkan progress, akan dicoba lagi nanti.', 'error');
  } finally {
    syncSedangBerjalan = false;
  }
}

export async function daftarkanSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-progress');
    } catch (err) {
      window.addEventListener('online', syncProgressKeServer);
    }
  } else {
    window.addEventListener('online', syncProgressKeServer);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_PROGRESS_REQUEST') {
        syncProgressKeServer();
      }
    });
  }

  if (navigator.onLine) {
    syncProgressKeServer();
  }
}
