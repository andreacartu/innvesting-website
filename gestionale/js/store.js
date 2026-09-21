// Archivio dati. Tutto resta nel browser del dispositivo (localStorage): niente server, niente account.
// Ogni modifica passa da `commit()`, che salva e avvisa chi ascolta (la UI si ridisegna).

import { buildDemo } from './demo.js';
import { exportPhotos, importPhotos, listPhotos, pruneOrphans, removePhotos } from './photos.js';

const KEY = 'innvesting-gestionale-v1';
const VERSION = 1;

const emptyState = () => ({
  version: VERSION,
  meta: { nextN: 1, lastBackup: null },
  properties: [],
  suppliers: [],
  costs: [],
  updates: [],
});

/* Valida e normalizza un archivio letto da localStorage o da un file di backup. */
function normalize(data) {
  if (!data || typeof data !== 'object') throw new Error('Il file non contiene un archivio valido.');
  const next = emptyState();
  for (const key of ['properties', 'suppliers', 'costs', 'updates']) {
    if (data[key] !== undefined && !Array.isArray(data[key])) throw new Error('Il file non contiene un archivio valido.');
    next[key] = data[key] ?? [];
  }
  // Le versioni precedenti distinguevano preventivi e spese: ora ogni voce è una spesa certa.
  // I preventivi rifiutati non erano spese, quindi si scartano; gli altri diventano spese.
  next.costs = next.costs.filter(cost => cost.stato !== 'rifiutato');
  next.costs.forEach(cost => {
    delete cost.stato;
    if (cost.dataPreventivo) { cost.data ??= cost.dataPreventivo; delete cost.dataPreventivo; }
    cost.pagamenti = Array.isArray(cost.pagamenti) ? cost.pagamenti : [];
  });
  const highest = Math.max(0, ...next.properties.map(p => Number(p.numero) || 0));
  next.meta = {
    nextN: Math.max(Number(data.meta?.nextN) || 1, highest + 1),
    lastBackup: data.meta?.lastBackup ?? null,
  };
  return next;
}

function load() {
  try {
    const stored = localStorage.getItem(KEY);
    return stored ? normalize(JSON.parse(stored)) : emptyState();
  } catch {
    return emptyState();
  }
}

let data = load();
const listeners = new Set();

export const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };

let pruneTimer;
function schedulePrune() {
  clearTimeout(pruneTimer);
  pruneTimer = setTimeout(() => pruneOrphans(usedPhotoIds()).catch(() => {}), 3000);
}

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    window.dispatchEvent(new CustomEvent('store:error'));
  }
  listeners.forEach(listener => listener());
  schedulePrune();
}

const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ── Lettura ────────────────────────────────────────────────────────────── */

export const state = () => data;
export const getProperty = id => data.properties.find(p => p.id === id);
export const getSupplier = id => data.suppliers.find(s => s.id === id);
export const getCost = id => data.costs.find(c => c.id === id);
export const getUpdate = id => data.updates.find(u => u.id === id);
export const isEmpty = () => !data.properties.length && !data.suppliers.length && !data.costs.length;

/* ── Immobili ───────────────────────────────────────────────────────────── */

export function addProperty(values) {
  const property = { id: uid(), numero: data.meta.nextN++, ...values };
  data.properties.push(property);
  commit();
  return property;
}

export function updateProperty(id, values) {
  Object.assign(getProperty(id), values);
  commit();
}

export function deleteProperty(id) {
  data.properties = data.properties.filter(p => p.id !== id);
  data.costs = data.costs.filter(c => c.propertyId !== id);
  data.updates = data.updates.filter(u => u.propertyId !== id);
  commit();
}

/* ── Fornitori ──────────────────────────────────────────────────────────── */

export function addSupplier(values) {
  const supplier = { id: uid(), ...values };
  data.suppliers.push(supplier);
  commit();
  return supplier;
}

export function updateSupplier(id, values) {
  Object.assign(getSupplier(id), values);
  commit();
}

export function deleteSupplier(id) {
  data.suppliers = data.suppliers.filter(s => s.id !== id);
  data.costs.forEach(c => { if (c.supplierId === id) c.supplierId = ''; });
  commit();
}

/* ── Costi (spese) ─────────────────────────────────────────── */

export function addCost(values) {
  const cost = { id: uid(), pagamenti: [], ...values };
  data.costs.push(cost);
  commit();
  return cost;
}

export function updateCost(id, values) {
  Object.assign(getCost(id), values);
  commit();
}

export function deleteCost(id) {
  data.costs = data.costs.filter(c => c.id !== id);
  commit();
}

/* ── Pagamenti (acconti, SAL, saldi) ────────────────────────────────────── */

export function addPayment(costId, values) {
  const payment = { id: uid(), ...values };
  getCost(costId).pagamenti.push(payment);
  commit();
  return payment;
}

export function updatePayment(costId, paymentId, values) {
  Object.assign(getCost(costId).pagamenti.find(p => p.id === paymentId), values);
  commit();
}

export function deletePayment(costId, paymentId) {
  const cost = getCost(costId);
  cost.pagamenti = cost.pagamenti.filter(p => p.id !== paymentId);
  commit();
}

/* ── Aggiornamenti di cantiere ──────────────────────────────────────────── */

export function addUpdate(values) {
  const update = { id: uid(), photoIds: [], visibile: true, ...values };
  data.updates.push(update);
  commit();
  return update;
}

export function updateUpdate(id, values) {
  Object.assign(getUpdate(id), values);
  commit();
}

export function deleteUpdate(id) {
  data.updates = data.updates.filter(u => u.id !== id);
  commit();
}

/* Tutte le foto ancora usate da qualche dato (copertina degli immobili e foto degli aggiornamenti). */
export function usedPhotoIds() {
  return new Set([
    ...data.properties.map(p => p.photoId).filter(Boolean),
    ...data.updates.flatMap(u => u.photoIds ?? []),
  ]);
}

/* ── Backup e ripristino ────────────────────────────────────────────────── */

/* Il backup contiene anche le foto (in base64), così un ripristino su un altro telefono è completo. */
export async function exportBackupJson() {
  const photos = await exportPhotos([...usedPhotoIds()]);
  return JSON.stringify({ ...data, photos });
}

export function markBackup() {
  data.meta.lastBackup = new Date().toISOString();
  commit();
}

export async function replaceAll(imported) {
  const next = normalize(imported);
  await importPhotos(imported.photos);
  data = next;
  commit();
}

export async function resetAll() {
  data = emptyState();
  commit();
  await removePhotos((await listPhotos()).map(p => p.id));
}

export function loadDemo() {
  const demo = buildDemo();
  data = normalize({ properties: demo.properties, suppliers: demo.suppliers, costs: demo.costs, updates: demo.updates, meta: { nextN: demo.nextN } });
  commit();
}

/* Chiede al browser di non cancellare i dati se lo spazio scarseggia (iOS lo concede alle app aggiunte alla Home). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
