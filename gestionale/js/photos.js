// Foto: ridimensionate sul telefono e conservate in IndexedDB (localStorage è troppo piccolo per le immagini).
// L'archivio dati tiene solo gli identificativi delle foto; qui stanno i file.

const DB_NAME = 'innvesting-gestionale-photos';
const STORE = 'photos';
const MAX_SIDE = 1400; // lato massimo in pixel
const QUALITY = 0.78;
const ORPHAN_GRACE_MS = 10 * 60 * 1000; // una foto appena salvata non si elimina finché non è collegata a un dato

let dbPromise = null;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ── Ridimensionamento ──────────────────────────────────────────────────── */

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });
  }
}

export async function shrinkImage(file) {
  const source = await decode(file);
  const width = source.width ?? source.naturalWidth;
  const height = source.height ?? source.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Immagine non valida'))), 'image/jpeg', QUALITY));
}

/* ── Archivio ───────────────────────────────────────────────────────────── */

export async function addPhoto(file) {
  const blob = await shrinkImage(file);
  const id = newId();
  await run('readwrite', store => store.put({ id, blob, createdAt: Date.now() }));
  return id;
}

export const getPhotoBlob = async id => (await run('readonly', store => store.get(id)))?.blob ?? null;
export const removePhotos = ids => Promise.all(ids.map(id => run('readwrite', store => store.delete(id)).then(() => forget(id))));
export const listPhotos = () => run('readonly', store => store.getAll());

/* Indirizzi temporanei (blob:) per mostrare le foto: si creano una volta sola per foto. */
const urlCache = new Map();

function forget(id) {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
}

/* Per le foto scattate su un altro dispositivo: chi ha accesso al server registra qui come scaricarle. */
let photoFetcher = null;
export const setPhotoFetcher = fetcher => { photoFetcher = fetcher; };

export const putPhotoBlob = (id, blob) => run('readwrite', store => store.put({ id, blob, createdAt: Date.now() }));

export async function photoUrl(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  let blob = await getPhotoBlob(id);
  if (!blob && photoFetcher) blob = await photoFetcher(id).catch(() => null);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

/* Riempie gli <img data-photo="ID"> presenti nel blocco. */
export async function hydratePhotos(root) {
  await Promise.all([...root.querySelectorAll('img[data-photo]')].map(async img => {
    const url = await photoUrl(img.dataset.photo);
    if (url) img.src = url;
    else img.closest('[data-photo-frame]')?.classList.add('is-missing');
  }));
}

/* Elimina le foto che nessun dato usa più. `usedIds` è l'insieme delle foto ancora referenziate. */
export async function pruneOrphans(usedIds) {
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const orphans = (await listPhotos()).filter(p => !usedIds.has(p.id) && p.createdAt < cutoff).map(p => p.id);
  if (orphans.length) await removePhotos(orphans);
}

/* ── Backup ─────────────────────────────────────────────────────────────── */

const blobToDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export async function exportPhotos(ids) {
  const out = {};
  for (const id of ids) {
    const blob = await getPhotoBlob(id);
    if (blob) out[id] = await blobToDataUrl(blob);
  }
  return out;
}

export async function importPhotos(map) {
  for (const [id, dataUrl] of Object.entries(map ?? {})) {
    const blob = await (await fetch(dataUrl)).blob();
    await run('readwrite', store => store.put({ id, blob, createdAt: Date.now() }));
  }
}
