import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { daftarkanSync } from './utils/syncManager';
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
