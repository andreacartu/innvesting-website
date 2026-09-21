// Client Supabase, caricato solo quando serve (la libreria arriva da una CDN).
// Il gestionale e l'area dell'investitore usano due sessioni separate, anche se stanno nello stesso browser.

import { CLOUD } from './cloud-config.js';

// Versione fissata: un aggiornamento della libreria non deve poter cambiare, da solo, il codice che gira con i dati degli immobili.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

export const isConfigured = () => Boolean(CLOUD.url && CLOUD.anonKey);

const clients = new Map();

export function getClient(storageKey) {
  if (!clients.has(storageKey)) {
    clients.set(storageKey, import(SDK_URL).then(({ createClient }) => createClient(CLOUD.url, CLOUD.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey },
    })));
  }
  return clients.get(storageKey);
}

export const BUCKET = 'photos';

/* Percorso di una foto nell'archivio: proprietario / immobile / foto. Le regole di accesso si basano su questa struttura. */
export const photoPath = (ownerId, propertyId, photoId) => `${ownerId}/${propertyId}/${photoId}.jpg`;

/* Le foto del gestionale, per l'uso su più dispositivi, stanno in una cartella "private" che l'investitore non può leggere:
   il suo accesso riguarda solo la cartella con l'id dell'immobile (vedi photoPath). */
export const privatePhotoPath = (ownerId, propertyId, photoId) => `${ownerId}/private/${propertyId}/${photoId}.jpg`;
