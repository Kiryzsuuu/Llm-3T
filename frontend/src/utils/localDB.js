import { openDB } from 'idb';

const DB_NAME = 'belajar-3t-db';
const DB_VERSION = 2;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('materi')) {
        db.createObjectStore('materi', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('soal')) {
        db.createObjectStore('soal', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('materiOffline')) {
        db.createObjectStore('materiOffline', { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        const store = db.createObjectStore('progress', { keyPath: 'materi_id' });
        store.createIndex('synced', 'synced');
      }
      if (!db.objectStoreNames.contains('jawaban')) {
        db.createObjectStore('jawaban', { keyPath: 'id', autoIncrement: true });
      }
      if (oldVersion < 2 && db.objectStoreNames.contains('pending_sync')) {
        db.deleteObjectStore('pending_sync');
      }
    },
  });
}

// --- helper generik (dipakai untuk cache materi/soal biasa) ---

export async function putItem(store, item) {
  const db = await getDB();
  return db.put(store, item);
}

export async function getAllItems(store) {
  const db = await getDB();
  return db.getAll(store);
}

export async function getItem(store, key) {
  const db = await getDB();
  return db.get(store, key);
}

export async function deleteItem(store, key) {
  const db = await getDB();
  return db.delete(store, key);
}

// --- progress offline ---

export async function simpanProgress(data) {
  const db = await getDB();
  return db.put('progress', { ...data, synced: false, updated_at: Date.now() });
}

export async function getProgressBelumSync() {
  const db = await getDB();
  const semua = await db.getAll('progress');
  return semua.filter((item) => item.synced === false);
}

export async function tandaiSudahSync(ids) {
  const db = await getDB();
  const tx = db.transaction('progress', 'readwrite');
  await Promise.all(
    ids.map(async (materiId) => {
      const item = await tx.store.get(materiId);
      if (item) {
        await tx.store.put({ ...item, synced: true });
      }
    })
  );
  await tx.done;
}

// --- jawaban soal offline ---

export async function simpanJawaban(data) {
  const db = await getDB();
  return db.add('jawaban', { ...data, timestamp: Date.now() });
}

export async function getJawabanByMateri(materiId) {
  const db = await getDB();
  const semua = await db.getAll('jawaban');
  return semua.filter((item) => item.materi_id === materiId);
}
