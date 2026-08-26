import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { daftarkanSync } from './utils/syncManager';
// Diimpor lokal (bukan dari CDN) supaya ikon tetap tampil tanpa internet — lihat README bagian
// "Deployment untuk Sekolah 3T (Tanpa Internet)".
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.error('Service worker gagal didaftarkan:', err);
    });
  });
}

daftarkanSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
