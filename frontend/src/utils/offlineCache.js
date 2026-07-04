import api from './api';
import { putItem, getItem, deleteItem, getAllItems } from './localDB';

export async function cacheMateri(materiList) {
  await Promise.all(materiList.map((m) => putItem('materi', m)));
}

export async function cacheSoal(soalList) {
  await Promise.all(soalList.map((s) => putItem('soal', s)));
}

export async function downloadMateri(materiId) {
  const { data: materi } = await api.get(`/materi/${materiId}`);
  await putItem('materiOffline', { ...materi, cached_at: Date.now() });

  try {
    const { data: soal } = await api.get('/soal', { params: { materi_id: materiId } });
    await cacheSoal(soal);
  } catch (err) {
    // soal offline bersifat best-effort, materi tetap tersimpan meski soal gagal diambil
  }

  return materi;
}

export async function isMateriOffline(materiId) {
  const item = await getItem('materiOffline', materiId);
  return Boolean(item);
}

export async function hapusMateriOffline(materiId) {
  return deleteItem('materiOffline', materiId);
}

export async function getAllMateriOffline() {
  return getAllItems('materiOffline');
}
