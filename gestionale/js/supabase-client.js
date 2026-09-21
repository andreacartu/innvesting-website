// Client Supabase, caricato solo quando serve (la libreria arriva da una CDN).
// Il gestionale e l'area dell'investitore usano due sessioni separate, anche se stanno nello stesso browser.

import { CLOUD } from './cloud-config.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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
