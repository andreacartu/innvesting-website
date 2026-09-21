// Condivisione online con l'investitore (Supabase).
//
// I dati restano nel gestionale, sul telefono. Per ogni immobile contrassegnato come "condiviso" il gestionale
// pubblica online una copia ridotta (vedi snapshot.js) e le foto; la copia si aggiorna da sola a ogni modifica.
// L'investitore la legge, in sola lettura, dall'area dedicata (investitore.html) accedendo con la sua email.

import { pendingCount, state, subscribe, wipeLocal } from './store.js';
import { getPhotoBlob } from './photos.js';
import { buildSnapshot, snapshotPhotoIds } from './snapshot.js';
import { BUCKET, getClient, isConfigured, photoPath } from './supabase-client.js';
import { forgetSyncState, startSync, stopSync, sync, syncData } from './sync.js';

export { isConfigured };

const AUTH_KEY = 'innvesting-auth-admin';
const TRACK_KEY = 'innvesting-gestionale-cloud';
const SYNC_DELAY_MS = 1500;

/* Stato visibile alle schermate: off | checking | signed-out | not-admin | idle | syncing | error */
export const cloud = { state: isConfigured() ? 'checking' : 'off', email: '', error: '', lastSync: null };

function setStatus(patch) {
  Object.assign(cloud, patch);
  window.dispatchEvent(new Event('cloud:change'));
}

/* Cosa è già stato pubblicato: impronta dell'ultima copia per immobile e foto già caricate. */
let tracking = readTracking();

function readTracking() {
  try {
    return { published: {}, uploaded: {}, at: {}, ...JSON.parse(localStorage.getItem(TRACK_KEY)) };
  } catch {
    return { published: {}, uploaded: {}, at: {} };
  }
}

const saveTracking = () => {
  try { localStorage.setItem(TRACK_KEY, JSON.stringify(tracking)); } catch { /* spazio esaurito: si ripubblica al prossimo giro */ }
};

async function fingerprint(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Accesso ────────────────────────────────────────────────────────────── */

const client = () => getClient(AUTH_KEY);

export async function sendCode(email) {
  const { error } = await (await client()).auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email, token) {
  const { error } = await (await client()).auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' });
  if (error) throw new Error('Codice non valido o scaduto.');
}

/* Esce dall'account e cancella la copia di questo dispositivo: i dati vivono solo sul database online.
   Prima si assicura che ogni modifica sia arrivata sul server, altrimenti la perderebbe. */
export async function signOut() {
  if (cloud.state !== 'not-admin') {
    await syncData();
    if (pendingCount() || sync.state === 'error') throw new Error('Ci sono modifiche non ancora salvate online: riprova con la connessione attiva.');
  }
  await (await client()).auth.signOut();
  stopSync();
  forgetSyncState();
  await wipeLocal();
}

async function refreshSession(session) {
  if (!session) {
    stopSync();
    return setStatus({ state: 'signed-out', email: '', error: '' });
  }
  const supabase = await client();
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (!error && !isAdmin) {
    stopSync();
    return setStatus({ state: 'not-admin', email: session.user.email, error: '' });
  }
  // Senza rete la verifica non risponde: la sessione salvata basta per aprire la copia sul telefono, le modifiche partiranno dopo.
  setStatus({ state: error ? 'error' : 'idle', email: session.user.email, error: error ? 'nessuna connessione.' : '' });
  startSync({ supabase, ownerId: session.user.id }); // dati online: da qui l'app scarica e invia le modifiche
  scheduleSync();
}

/* Esce dall'account solo su questo dispositivo e dimentica lo stato dell'allineamento (per esempio quando si dimentica il codice di sblocco). */
export async function signOutLocal() {
  try { await (await client()).auth.signOut({ scope: 'local' }); } catch { /* già fuori */ }
  stopSync();
  forgetSyncState();
}

export async function initCloud() {
  if (!isConfigured()) return;
  try {
    const supabase = await client();
    // Le chiamate a Supabase dentro questo callback vanno rimandate, altrimenti la libreria si blocca.
    supabase.auth.onAuthStateChange((_event, session) => { setTimeout(() => refreshSession(session), 0); });
    const { data } = await supabase.auth.getSession();
    await refreshSession(data.session);
  } catch (error) {
    setStatus({ state: 'error', error: 'Impossibile collegarsi al servizio online.' });
  }
  subscribe(scheduleSync);
  window.addEventListener('online', scheduleSync);
}

/* ── Pubblicazione ──────────────────────────────────────────────────────── */

async function uploadPhotos(supabase, ownerId, propertyId, photoIds) {
  for (const id of photoIds) {
    if (tracking.uploaded[`${propertyId}/${id}`]) continue;
    const blob = await getPhotoBlob(id);
    if (!blob) continue;
    const { error } = await supabase.storage.from(BUCKET).upload(photoPath(ownerId, propertyId, id), blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
    tracking.uploaded[`${propertyId}/${id}`] = true;
  }
}

async function publish(supabase, ownerId, property) {
  const snapshot = buildSnapshot(property, state());
  const fingerprintNow = await fingerprint(JSON.stringify({ snapshot, email: property.investitoreEmail }));
  if (tracking.published[property.id] === fingerprintNow) return;

  await uploadPhotos(supabase, ownerId, property.id, snapshotPhotoIds(snapshot));
  const { error } = await supabase.from('shared_properties').upsert({
    id: property.id,
    owner_id: ownerId,
    investor_email: property.investitoreEmail.trim().toLowerCase(),
    snapshot,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  tracking.published[property.id] = fingerprintNow;
  tracking.at[property.id] = new Date().toISOString();
  saveTracking();
}

async function unpublish(supabase, ownerId, propertyId) {
  const { error } = await supabase.from('shared_properties').delete().eq('id', propertyId);
  if (error) throw new Error(error.message);

  const folder = `${ownerId}/${propertyId}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(folder);
  if (files?.length) await supabase.storage.from(BUCKET).remove(files.map(f => `${folder}/${f.name}`));

  delete tracking.published[propertyId];
  delete tracking.at[propertyId];
  Object.keys(tracking.uploaded).filter(key => key.startsWith(`${propertyId}/`)).forEach(key => delete tracking.uploaded[key]);
  saveTracking();
}

let running = false;
let again = false;
let timer;

export function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(syncNow, SYNC_DELAY_MS);
}

export async function syncNow() {
  if (!['idle', 'error'].includes(cloud.state)) return;
  if (running) { again = true; return; }
  running = true;
  setStatus({ state: 'syncing', error: '' });
  try {
    const supabase = await client();
    const { data } = await supabase.auth.getSession();
    const ownerId = data.session?.user.id;
    if (!ownerId) throw new Error('Sessione scaduta: accedi di nuovo.');

    const shared = state().properties.filter(p => p.condiviso && p.investitoreEmail);
    for (const property of shared) await publish(supabase, ownerId, property);

    const stillShared = new Set(shared.map(p => p.id));
    for (const propertyId of Object.keys(tracking.published)) {
      if (!stillShared.has(propertyId)) await unpublish(supabase, ownerId, propertyId);
    }
    setStatus({ state: 'idle', lastSync: new Date().toISOString() });
  } catch (error) {
    setStatus({ state: 'error', error: error.message || 'Sincronizzazione non riuscita.' });
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(); }
  }
}

/* ── Testo di stato per le schermate ────────────────────────────────────── */

const timeOf = iso => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

export function shareStatusLabel(property) {
  switch (cloud.state) {
    case 'off': return 'Condivisione online non ancora attivata (vedi Altro).';
    case 'checking': return 'Controllo della condivisione…';
    case 'signed-out': return 'Condivisione ferma: accedi dalla schermata Altro.';
    case 'not-admin': return 'Questo account non è abilitato a condividere.';
    case 'syncing': return 'Aggiornamento in corso…';
    case 'error': return `Non sincronizzato: ${cloud.error}`;
    default: {
      const at = tracking.at[property.id];
      const who = property.investitoreNome || property.investitoreEmail;
      return at ? `Condiviso con ${who} · aggiornato alle ${timeOf(at)}` : `In attesa di condividere con ${who}…`;
    }
  }
}
