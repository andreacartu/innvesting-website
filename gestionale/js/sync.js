// Allineamento dei dati con il server (Supabase), tramite le sue API.
//
// Il server tiene un archivio unico (tabella `records`): un record per immobile, fornitore, costo (con i suoi pagamenti)
// e aggiornamento di cantiere. Il gestionale invia ogni modifica appena la fa e scarica quelle degli altri dispositivi:
// all'apertura, quando l'app torna in primo piano e in tempo reale, appena qualcosa cambia online.
// Se due dispositivi modificano lo stesso elemento contemporaneamente, vince l'ultimo che invia.

import { allEntities, applyRemote, entityOf, isEmpty, markAllForUpload, pendingCount, pendingEntries, queueDelete, settleEntries, state, subscribe, wipeLocal } from './store.js';
import { getPhotoBlob, putPhotoBlob, setPhotoFetcher } from './photos.js';
import { BUCKET, privatePhotoPath } from './supabase-client.js';

const STATE_KEY = 'innvesting-gestionale-sync';
const UPLOADED_KEY = 'innvesting-gestionale-photos-online';
const EPOCH = '1970-01-01T00:00:00+00:00';
const PUSH_CHUNK = 50;
const PULL_LIMIT = 1000;
const DEBOUNCE_MS = 800;
const POLL_MS = 60_000; // rete di sicurezza se il collegamento in tempo reale si interrompe

/* Stato visibile alle schermate: off | syncing | idle | error */
export const sync = { state: 'off', pending: 0, last: null, error: '' };

function setStatus(patch = {}) {
  Object.assign(sync, patch, { pending: pendingCount() });
  window.dispatchEvent(new Event('sync:change'));
}

/* Punto raggiunto con questo account: a quale record ci si è fermati nello scaricare le modifiche. */
const readState = () => {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) ?? {}; } catch { return {}; }
};
const writeState = value => {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(value)); } catch { /* si riparte da capo al prossimo giro */ }
};
export const forgetSyncState = () => {
  localStorage.removeItem(STATE_KEY);
  localStorage.removeItem(UPLOADED_KEY);
};

const readUploaded = () => {
  try { return new Set(JSON.parse(localStorage.getItem(UPLOADED_KEY)) ?? []); } catch { return new Set(); }
};
const writeUploaded = set => {
  try { localStorage.setItem(UPLOADED_KEY, JSON.stringify([...set])); } catch { /* si ricarica */ }
};

let context = null; // { supabase, ownerId }
let running = false;
let again = false;
let debounce;
let poll;
let channel;
let unsubscribeStore;

/* ── Primo allineamento con un account ──────────────────────────────────── */

async function serverKeys() {
  const { supabase, ownerId } = context;
  const { data, error } = await supabase.from('records').select('kind,id').eq('owner_id', ownerId).eq('deleted', false);
  if (error) throw new Error(error.message);
  return data;
}

async function initialize() {
  const saved = readState();
  if (saved.owner === context.ownerId && saved.cursor) return;

  // La copia sul telefono appartiene a un altro account: il database di questo è l'unica fonte.
  if (saved.owner && saved.owner !== context.ownerId) await wipeLocal();

  const onServer = await serverKeys();
  const hasLocal = !isEmpty();

  if (onServer.length && hasLocal) {
    const useServer = confirm(
      'Online ci sono già dei dati. Premi OK per usare quelli online: i dati di questo dispositivo vengono sostituiti. ' +
      'Premi Annulla per caricare invece quelli di questo dispositivo: i dati online vengono sostituiti.'
    );
    if (useServer) {
      await wipeLocal();
    } else {
      const local = new Set(allEntities().map(({ kind, id }) => `${kind}:${id}`));
      onServer.filter(({ kind, id }) => !local.has(`${kind}:${id}`)).forEach(({ kind, id }) => queueDelete(kind, id));
      markAllForUpload();
    }
  } else if (hasLocal) {
    markAllForUpload();
  }
  writeState({ owner: context.ownerId, cursor: EPOCH });
}

/* ── Invio ──────────────────────────────────────────────────────────────── */

async function push() {
  const { supabase, ownerId } = context;
  for (;;) {
    const entries = pendingEntries().slice(0, PUSH_CHUNK);
    if (!entries.length) return;

    const rows = entries.map(({ kind, id, op }) => {
      const entity = op === 'upsert' ? entityOf(kind, id) : null;
      return entity
        ? { owner_id: ownerId, kind, id, data: entity, deleted: false }
        : { owner_id: ownerId, kind, id, data: {}, deleted: true };
    });
    const { error } = await supabase.from('records').upsert(rows, { onConflict: 'owner_id,kind,id' });
    if (error) throw new Error(error.message);
    settleEntries(entries);
    setStatus();
  }
}

/* ── Scaricamento ───────────────────────────────────────────────────────── */

async function pull() {
  const { supabase, ownerId } = context;
  const saved = readState();
  let cursor = saved.cursor ?? EPOCH;

  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('kind,id,data,deleted,updated_at')
      .eq('owner_id', ownerId)
      .gte('updated_at', cursor) // "gte": più record inviati insieme hanno lo stesso istante; riapplicarli non cambia nulla
      .order('updated_at', { ascending: true })
      .limit(PULL_LIMIT);
    if (error) throw new Error(error.message);

    if (data.length) {
      applyRemote(data);
      cursor = data[data.length - 1].updated_at;
      writeState({ ...saved, owner: ownerId, cursor });
    }
    if (data.length < PULL_LIMIT) return;
  }
}

/* ── Foto ───────────────────────────────────────────────────────────────── */

/* Dove sta una foto: serve l'immobile a cui appartiene (copertina o foto di un aggiornamento). */
function locatePhoto(photoId) {
  const { properties, updates } = state();
  return properties.find(p => p.photoId === photoId)?.id ?? updates.find(u => (u.photoIds ?? []).includes(photoId))?.propertyId ?? null;
}

async function pushPhotos() {
  const { supabase, ownerId } = context;
  const { properties, updates } = state();
  const uploaded = readUploaded();
  const wanted = [
    ...properties.filter(p => p.photoId).map(p => [p.id, p.photoId]),
    ...updates.flatMap(u => (u.photoIds ?? []).map(photoId => [u.propertyId, photoId])),
  ];

  for (const [propertyId, photoId] of wanted) {
    if (uploaded.has(photoId)) continue;
    const blob = await getPhotoBlob(photoId);
    if (!blob) continue; // la foto è su un altro dispositivo, che la caricherà
    const { error } = await supabase.storage.from(BUCKET).upload(privatePhotoPath(ownerId, propertyId, photoId), blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    uploaded.add(photoId);
    writeUploaded(uploaded);
  }
}

async function downloadPhoto(photoId) {
  if (!context) return null;
  const propertyId = locatePhoto(photoId);
  if (!propertyId) return null;
  const { data, error } = await context.supabase.storage.from(BUCKET).download(privatePhotoPath(context.ownerId, propertyId, photoId));
  if (error || !data) return null;
  await putPhotoBlob(photoId, data);
  return data;
}

/* ── Ciclo di sincronizzazione ──────────────────────────────────────────── */

async function cycle() {
  if (!context) return;
  if (running) { again = true; return; }
  running = true;
  setStatus({ state: 'syncing', error: '' });
  try {
    await initialize();
    await push();
    await pull();
    await pushPhotos();
    setStatus({ state: 'idle', last: new Date().toISOString(), error: '' });
  } catch (error) {
    const offline = !navigator.onLine || /failed to fetch|network|load failed/i.test(error.message ?? '');
    setStatus({ state: 'error', error: offline ? 'nessuna connessione.' : (error.message || 'sincronizzazione non riuscita.') });
  } finally {
    running = false;
    if (again) { again = false; schedule(); }
  }
}

function schedule(delay = DEBOUNCE_MS) {
  clearTimeout(debounce);
  debounce = setTimeout(cycle, delay);
}

/* Sincronizza subito (pulsante "Aggiorna ora"). */
export const syncData = () => { clearTimeout(debounce); return cycle(); };

const onVisible = () => { if (document.visibilityState === 'visible') schedule(0); };

export function startSync(ctx) {
  stopSync();
  context = ctx;
  setPhotoFetcher(downloadPhoto);
  unsubscribeStore = subscribe(() => schedule());
  window.addEventListener('online', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  poll = setInterval(onVisible, POLL_MS);

  // Quando qualcosa cambia online (un altro dispositivo) arriva subito una notifica.
  channel = ctx.supabase.channel('records-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `owner_id=eq.${ctx.ownerId}` }, () => schedule(300))
    .subscribe();

  setStatus({ state: 'syncing', error: '' });
  schedule(0);
}

export function stopSync() {
  clearTimeout(debounce);
  clearInterval(poll);
  unsubscribeStore?.();
  unsubscribeStore = null;
  window.removeEventListener('online', onVisible);
  document.removeEventListener('visibilitychange', onVisible);
  context?.supabase.removeChannel?.(channel);
  channel = null;
  context = null;
  setPhotoFetcher(null);
  setStatus({ state: 'off' });
}
