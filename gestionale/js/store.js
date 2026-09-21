// Archivio dati del gestionale.
//
// La copia di lavoro sta nel browser (localStorage): l'app si apre subito e funziona anche senza rete.
// Se l'accesso online è attivo, `sync.js` tiene questa copia allineata al server (Supabase): ogni modifica finisce in una
// coda di invio ("outbox") e le modifiche fatte da altri dispositivi arrivano con `applyRemote`.
// Ogni modifica passa da `commit()`, che salva e avvisa chi ascolta (la UI si ridisegna).

import { buildDemo } from './demo.js';
import { exportPhotos, importPhotos, listPhotos, pruneOrphans, removePhotos } from './photos.js';

const KEY = 'innvesting-gestionale-v1';
const OUTBOX_KEY = 'innvesting-gestionale-outbox';
const VERSION = 1;

/* I quattro tipi di elemento che si sincronizzano, e in quale lista dell'archivio stanno. */
const KINDS = { property: 'properties', supplier: 'suppliers', cost: 'costs', update: 'updates' };

const emptyState = () => ({
  version: VERSION,
  meta: { nextN: 1, lastBackup: null },
  properties: [],
  suppliers: [],
  costs: [],
  updates: [],
});

/* Valida e normalizza un elemento (letto dal server, da un file o dall'archivio locale). */
function normalizeEntity(kind, entity) {
  if (kind === 'cost') {
    // Le versioni precedenti distinguevano preventivi e spese: ora ogni voce è una spesa certa.
    const { stato, dataPreventivo, ...rest } = entity;
    const cost = { ...rest, pagamenti: Array.isArray(rest.pagamenti) ? rest.pagamenti : [] };
    if (dataPreventivo) cost.data ??= dataPreventivo;
    return cost;
  }
  return entity;
}

/* Valida e normalizza un archivio letto da localStorage o da un file di backup. */
function normalize(input) {
  if (!input || typeof input !== 'object') throw new Error('Il file non contiene un archivio valido.');
  const next = emptyState();
  for (const [kind, key] of Object.entries(KINDS)) {
    if (input[key] !== undefined && !Array.isArray(input[key])) throw new Error('Il file non contiene un archivio valido.');
    next[key] = (input[key] ?? []).filter(item => !(kind === 'cost' && item.stato === 'rifiutato')).map(item => normalizeEntity(kind, item));
  }
  const highest = Math.max(0, ...next.properties.map(p => Number(p.numero) || 0));
  next.meta = {
    nextN: Math.max(Number(input.meta?.nextN) || 1, highest + 1),
    lastBackup: input.meta?.lastBackup ?? null,
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

/* ── Coda di invio ──────────────────────────────────────────────────────── */

// chiave "tipo:id" → { op: 'upsert' | 'delete', seq }. Il numero d'ordine serve a non perdere una modifica
// fatta mentre la precedente è ancora in viaggio verso il server.
let outbox = readOutbox();
let sequence = Math.max(0, ...[...outbox.values()].map(entry => entry.seq ?? 0));

function readOutbox() {
  try {
    return new Map(Object.entries(JSON.parse(localStorage.getItem(OUTBOX_KEY)) ?? {}));
  } catch {
    return new Map();
  }
}

function saveOutbox() {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(Object.fromEntries(outbox)));
  } catch { /* si riprova al prossimo salvataggio */ }
}

function mark(kind, id, op = 'upsert') {
  outbox.set(`${kind}:${id}`, { op, seq: ++sequence });
}

export const pendingCount = () => outbox.size;

/* Segnala come cancellato, sul server, un elemento che qui non esiste (per sostituire i dati online con quelli locali). */
export function queueDelete(kind, id) {
  mark(kind, id, 'delete');
  saveOutbox();
}

export const pendingEntries = () => [...outbox].map(([key, { op, seq }]) => {
  const [kind, ...rest] = key.split(':');
  return { kind, id: rest.join(':'), op, seq };
});

/* Toglie dalla coda le voci inviate, salvo quelle modificate di nuovo nel frattempo. */
export function settleEntries(sent) {
  sent.forEach(({ kind, id, seq }) => {
    const key = `${kind}:${id}`;
    if (outbox.get(key)?.seq === seq) outbox.delete(key);
  });
  saveOutbox();
}

/* ── Salvataggio e notifiche ────────────────────────────────────────────── */

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
  saveOutbox();
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

export const entityOf = (kind, id) => data[KINDS[kind]].find(item => item.id === id);
export const allEntities = () => Object.entries(KINDS).flatMap(([kind, key]) => data[key].map(item => ({ kind, id: item.id })));

/* ── Immobili ───────────────────────────────────────────────────────────── */

export function addProperty(values) {
  const property = { id: uid(), numero: data.meta.nextN++, ...values };
  data.properties.push(property);
  mark('property', property.id);
  commit();
  return property;
}

export function updateProperty(id, values) {
  Object.assign(getProperty(id), values);
  mark('property', id);
  commit();
}

export function deleteProperty(id) {
  data.costs.filter(c => c.propertyId === id).forEach(c => mark('cost', c.id, 'delete'));
  data.updates.filter(u => u.propertyId === id).forEach(u => mark('update', u.id, 'delete'));
  mark('property', id, 'delete');
  data.properties = data.properties.filter(p => p.id !== id);
  data.costs = data.costs.filter(c => c.propertyId !== id);
  data.updates = data.updates.filter(u => u.propertyId !== id);
  commit();
}

/* ── Fornitori ──────────────────────────────────────────────────────────── */

export function addSupplier(values) {
  const supplier = { id: uid(), ...values };
  data.suppliers.push(supplier);
  mark('supplier', supplier.id);
  commit();
  return supplier;
}

export function updateSupplier(id, values) {
  Object.assign(getSupplier(id), values);
  mark('supplier', id);
  commit();
}

export function deleteSupplier(id) {
  data.suppliers = data.suppliers.filter(s => s.id !== id);
  data.costs.forEach(c => { if (c.supplierId === id) { c.supplierId = ''; mark('cost', c.id); } });
  mark('supplier', id, 'delete');
  commit();
}

/* ── Costi (spese) ──────────────────────────────────────────────────────── */

export function addCost(values) {
  const cost = { id: uid(), pagamenti: [], ...values };
  data.costs.push(cost);
  mark('cost', cost.id);
  commit();
  return cost;
}

export function updateCost(id, values) {
  Object.assign(getCost(id), values);
  mark('cost', id);
  commit();
}

export function deleteCost(id) {
  data.costs = data.costs.filter(c => c.id !== id);
  mark('cost', id, 'delete');
  commit();
}

/* ── Pagamenti (acconti, SAL, saldi): stanno dentro il costo a cui appartengono ── */

export function addPayment(costId, values) {
  const payment = { id: uid(), ...values };
  getCost(costId).pagamenti.push(payment);
  mark('cost', costId);
  commit();
  return payment;
}

export function updatePayment(costId, paymentId, values) {
  Object.assign(getCost(costId).pagamenti.find(p => p.id === paymentId), values);
  mark('cost', costId);
  commit();
}

export function deletePayment(costId, paymentId) {
  const cost = getCost(costId);
  cost.pagamenti = cost.pagamenti.filter(p => p.id !== paymentId);
  mark('cost', costId);
  commit();
}

/* ── Aggiornamenti di cantiere ──────────────────────────────────────────── */

export function addUpdate(values) {
  const update = { id: uid(), photoIds: [], visibile: true, ...values };
  data.updates.push(update);
  mark('update', update.id);
  commit();
  return update;
}

export function updateUpdate(id, values) {
  Object.assign(getUpdate(id), values);
  mark('update', id);
  commit();
}

export function deleteUpdate(id) {
  data.updates = data.updates.filter(u => u.id !== id);
  mark('update', id, 'delete');
  commit();
}

/* Tutte le foto ancora usate da qualche dato (copertina degli immobili e foto degli aggiornamenti). */
export function usedPhotoIds() {
  return new Set([
    ...data.properties.map(p => p.photoId).filter(Boolean),
    ...data.updates.flatMap(u => u.photoIds ?? []),
  ]);
}

/* ── Allineamento con il server ─────────────────────────────────────────── */

/* Applica le modifiche arrivate dal server. Un elemento con una modifica locale ancora da inviare non si tocca:
   vince la modifica locale, che partirà al prossimo invio. */
export function applyRemote(rows) {
  let changed = false;

  for (const { kind, id, data: entity, deleted } of rows) {
    const key = KINDS[kind];
    if (!key || outbox.has(`${kind}:${id}`)) continue;
    const index = data[key].findIndex(item => item.id === id);

    if (deleted) {
      if (index >= 0) { data[key].splice(index, 1); changed = true; }
      continue;
    }
    const incoming = normalizeEntity(kind, { ...entity, id });
    if (index < 0) {
      data[key].push(incoming);
      changed = true;
    } else if (JSON.stringify(data[key][index]) !== JSON.stringify(incoming)) {
      data[key][index] = incoming;
      changed = true;
    }
  }

  if (changed) {
    data.meta.nextN = Math.max(data.meta.nextN, ...data.properties.map(p => (Number(p.numero) || 0) + 1));
    commit();
  }
  return changed;
}

/* Mette in coda tutto quello che c'è nell'archivio locale (primo caricamento sul server). */
export function markAllForUpload() {
  allEntities().forEach(({ kind, id }) => mark(kind, id));
  commit();
}

/* Svuota l'archivio locale senza toccare il server (per ripartire da quello che c'è online). */
export async function wipeLocal() {
  data = { ...emptyState(), meta: { ...emptyState().meta, lastBackup: data.meta.lastBackup } };
  outbox.clear();
  commit();
  await removePhotos((await listPhotos()).map(p => p.id));
}

/* Identificativi presenti ora, per segnalare come cancellati quelli che spariscono dopo una sostituzione completa. */
const idsByKind = () => Object.fromEntries(Object.entries(KINDS).map(([kind, key]) => [kind, data[key].map(item => item.id)]));

function markReplacement(before) {
  for (const [kind, key] of Object.entries(KINDS)) {
    const now = new Set(data[key].map(item => item.id));
    (before[kind] ?? []).filter(id => !now.has(id)).forEach(id => mark(kind, id, 'delete'));
    now.forEach(id => mark(kind, id));
  }
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

/* Aggiunge al gestionale gli immobili, i fornitori e i costi di un file, senza toccare quello che c'è già.
   Un elemento con lo stesso id di uno esistente viene saltato (così un file importato due volte non crea doppioni
   e non sovrascrive le modifiche fatte nel frattempo); i fornitori con lo stesso nome si riusano. */
export function mergeImport(imported) {
  const incoming = normalize(imported);
  const added = { properties: 0, suppliers: 0, costs: 0, updates: 0 };

  const supplierByName = new Map(data.suppliers.map(s => [s.nome.trim().toLowerCase(), s.id]));
  const supplierIds = new Map(); // id nel file → id nel gestionale
  for (const supplier of incoming.suppliers) {
    const key = supplier.nome.trim().toLowerCase();
    if (supplierByName.has(key)) { supplierIds.set(supplier.id, supplierByName.get(key)); continue; }
    data.suppliers.push(supplier);
    mark('supplier', supplier.id);
    supplierByName.set(key, supplier.id);
    supplierIds.set(supplier.id, supplier.id);
    added.suppliers++;
  }

  const knownProperties = new Set(data.properties.map(p => p.id));
  const newProperties = new Set();
  for (const property of incoming.properties) {
    if (knownProperties.has(property.id)) continue;
    data.properties.push({ ...property, numero: data.meta.nextN++ });
    mark('property', property.id);
    newProperties.add(property.id);
    added.properties++;
  }

  // Costi e aggiornamenti si aggiungono solo agli immobili nuovi: quelli già presenti restano come sono.
  const knownCosts = new Set(data.costs.map(c => c.id));
  for (const cost of incoming.costs) {
    if (knownCosts.has(cost.id) || !newProperties.has(cost.propertyId)) continue;
    data.costs.push({ ...cost, supplierId: supplierIds.get(cost.supplierId) ?? '' });
    mark('cost', cost.id);
    added.costs++;
  }
  const knownUpdates = new Set(data.updates.map(u => u.id));
  for (const update of incoming.updates) {
    if (knownUpdates.has(update.id) || !newProperties.has(update.propertyId)) continue;
    data.updates.push(update);
    mark('update', update.id);
    added.updates++;
  }

  commit();
  return added;
}

/* Ripristino da backup: sostituisce tutto, anche online se l'accesso è attivo. */
export async function replaceAll(imported) {
  const next = normalize(imported);
  await importPhotos(imported.photos);
  const before = idsByKind();
  data = next;
  markReplacement(before);
  commit();
}

/* Svuota solo questo dispositivo. Se l'accesso online è attivo, i dati tornano dal server alla prossima sincronizzazione. */
export async function resetAll() {
  await wipeLocal();
}

export function loadDemo() {
  const demo = buildDemo();
  const before = idsByKind();
  data = normalize({ properties: demo.properties, suppliers: demo.suppliers, costs: demo.costs, updates: demo.updates, meta: { nextN: demo.nextN } });
  markReplacement(before);
  commit();
}

/* Chiede al browser di non cancellare i dati se lo spazio scarseggia (iOS lo concede alle app aggiunte alla Home). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}
