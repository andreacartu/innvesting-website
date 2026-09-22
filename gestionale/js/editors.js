// Moduli di inserimento e modifica per immobili, fornitori, costi e pagamenti.

import { openForm } from './sheet.js';
import { addPhoto } from './photos.js';
import { todayISO, euro } from './format.js';
import { ALIQUOTE_IVA, CATEGORIE_COSTO, STATI_IMMOBILE, TIPI_FORNITORE } from './labels.js';
import { costTotal, costUnallocated, propertyCode, round2 } from './calc.js';
import {
  addCost, addPayment, addProperty, addSupplier, addUpdate, deleteCost, deletePayment, deleteProperty, deleteSupplier, deleteUpdate,
  getCost, getProperty, getSupplier, getUpdate, state, updateCost, updatePayment, updateProperty, updateSupplier, updateUpdate,
} from './store.js';

const propertyOptions = () => state().properties.map(p => ({ value: p.id, label: `${propertyCode(p)} · ${p.nome}` }));
/* Suggerimenti per il campo zona: quelle già usate nell'immobile, poi alcune comuni. */
const DEFAULT_ZONES = ['Professionisti', 'Lavori di ristrutturazione', 'Cucina', 'Bagno', 'Soggiorno', 'Camera', 'Ingresso', 'Esterni'];
const zoneSuggestions = propertyId => {
  const used = state().costs.filter(c => !propertyId || c.propertyId === propertyId).map(c => (c.zona ?? '').trim()).filter(Boolean);
  return [...new Set([...used, ...DEFAULT_ZONES])];
};

const supplierOptions = () => [...state().suppliers].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map(s => ({ value: s.id, label: s.nome }));

/* ── Immobile ───────────────────────────────────────────────────────────── */

/* Salva i nuovi file scelti in un campo foto e restituisce gli identificativi finali (quelli mantenuti più i nuovi). */
async function persistPhotos({ ids, files }) {
  const added = [];
  for (const file of files) added.push(await addPhoto(file));
  return [...ids, ...added];
}

export function openPropertyForm(id) {
  const property = id ? getProperty(id) : null;
  const costCount = property ? state().costs.filter(c => c.propertyId === id).length : 0;

  return openForm({
    title: property ? 'Modifica immobile' : 'Nuovo immobile',
    values: property ? { ...property, foto: property.photoId } : { stato: 'ricerca', avanzamento: 0 },
    fields: [
      { name: 'foto', label: 'Foto esterna', type: 'photos', max: 1 },
      { name: 'nome', label: 'Nome', required: true, placeholder: 'Es. Trilocale in centro' },
      { name: 'indirizzo', label: 'Indirizzo o zona', placeholder: 'Es. Via Roma 12, Treviso' },
      { name: 'cliente', label: 'Cliente', placeholder: 'A nome di chi è il rogito' },
      { name: 'investitoreNome', label: 'Investitore', placeholder: 'Chi mette il capitale' },
      { name: 'investitoreEmail', label: 'Email dell’investitore', type: 'email', placeholder: 'nome@email.it' },
      { name: 'condiviso', label: 'Condividi i lavori in tempo reale con l’investitore', type: 'checkbox', hint: 'Lo vede accedendo con la sua email: solo questo immobile, in sola lettura. Serve la condivisione online attiva (Altro).' },
      { name: 'stato', label: 'Fase', type: 'select', required: true, options: STATI_IMMOBILE, half: true },
      { name: 'avanzamento', label: 'Avanzamento lavori', type: 'percent', half: true, placeholder: '0' },
      { name: 'prezzoAcquisto', label: 'Prezzo di acquisto', type: 'money', half: true },
      { name: 'speseAcquisto', label: 'Spese di acquisto', type: 'money', half: true },
      { name: 'budgetLavori', label: 'Budget lavori', type: 'money', half: true },
      { name: 'prezzoObiettivo', label: 'Rivendita obiettivo', type: 'money', half: true },
      { name: 'prezzoVendita', label: 'Prezzo di vendita effettivo', type: 'money', hint: 'Da compilare a vendita conclusa: sostituisce l’obiettivo nel calcolo del margine.' },
      { name: 'note', label: 'Note (private)', type: 'textarea' },
    ],
    onSubmit: async ({ foto, ...values }) => {
      const data = {
        ...values,
        investitoreEmail: values.investitoreEmail.toLowerCase(),
        avanzamento: Math.min(100, Math.max(0, values.avanzamento ?? 0)),
        photoId: (await persistPhotos(foto))[0] ?? '',
      };
      if (data.condiviso && !data.investitoreEmail) throw new Error('Per condividere i lavori serve l’email dell’investitore.');
      return property ? (updateProperty(id, data), id) : addProperty(data).id;
    },
    onDelete: property && (() => deleteProperty(id)),
    deleteMessage: `Eliminare “${property?.nome}” con i suoi ${costCount} costi, gli aggiornamenti e i relativi pagamenti? L’operazione non si può annullare.`,
  });
}

/* ── Aggiornamento di cantiere ──────────────────────────────────────────── */

export function openUpdateForm({ id, propertyId } = {}) {
  const update = id ? getUpdate(id) : null;

  return openForm({
    title: update ? 'Modifica aggiornamento' : 'Nuovo aggiornamento',
    values: update ? { ...update, foto: update.photoIds } : { data: todayISO(), visibile: true },
    fields: [
      { name: 'titolo', label: 'Titolo', required: true, placeholder: 'Es. Impianti completati' },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'testo', label: 'Cosa è stato fatto', type: 'textarea', placeholder: 'Due righe per l’investitore: cosa è stato fatto e cosa segue.' },
      { name: 'foto', label: 'Foto del cantiere', type: 'photos' },
      { name: 'visibile', label: 'Visibile all’investitore', type: 'checkbox' },
    ],
    onSubmit: async ({ foto, ...values }) => {
      const data = { ...values, photoIds: await persistPhotos(foto) };
      return update ? (updateUpdate(id, data), id) : addUpdate({ ...data, propertyId }).id;
    },
    onDelete: update && (() => deleteUpdate(id)),
    deleteMessage: `Eliminare l’aggiornamento “${update?.titolo}”?`,
  });
}

/* ── Fornitore ──────────────────────────────────────────────────────────── */

export function openSupplierForm(id) {
  const supplier = id ? getSupplier(id) : null;
  const costCount = supplier ? state().costs.filter(c => c.supplierId === id).length : 0;

  return openForm({
    title: supplier ? 'Modifica fornitore' : 'Nuovo fornitore',
    values: supplier ?? {},
    fields: [
      { name: 'nome', label: 'Nome o ragione sociale', required: true },
      { name: 'tipo', label: 'Tipo', type: 'select', options: TIPI_FORNITORE },
      { name: 'referente', label: 'Referente' },
      { name: 'telefono', label: 'Telefono', type: 'tel', half: true },
      { name: 'email', label: 'Email', type: 'email', half: true },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    onSubmit: values => (supplier ? (updateSupplier(id, values), id) : addSupplier(values).id),
    onDelete: supplier && (() => deleteSupplier(id)),
    deleteMessage: costCount
      ? `Eliminare “${supplier?.nome}”? I ${costCount} costi collegati restano, ma senza fornitore.`
      : `Eliminare “${supplier?.nome}”?`,
  });
}

/* ── Costo ─────────────────────────────────────────── */

export function openCostForm({ id, propertyId, supplierId } = {}) {
  const cost = id ? getCost(id) : null;
  const property = getProperty(cost?.propertyId ?? propertyId);
  const prezzoVendita = property?.prezzoVendita || property?.prezzoObiettivo || 0;

  // Per spese come la provvigione dell'agenzia, più comode da pensare in percentuale che a importo fisso:
  // il campo compare solo se l'immobile ha già un prezzo (di acquisto o di vendita) su cui calcolarla.
  const basiPercentuale = [
    property?.prezzoAcquisto && { value: 'acquisto', label: `Acquisto (${euro(property.prezzoAcquisto)})` },
    prezzoVendita && { value: 'vendita', label: `Vendita (${euro(prezzoVendita)})` },
  ].filter(Boolean);

  return openForm({
    title: cost ? 'Modifica costo' : 'Nuovo costo',
    values: cost ?? { propertyId, supplierId, iva: 10, data: todayISO() },
    fields: [
      { name: 'propertyId', label: 'Immobile', type: 'select', required: true, options: propertyOptions, placeholder: 'Scegli l’immobile' },
      { name: 'descrizione', label: 'Voce', required: true, placeholder: 'Es. Impianto elettrico completo' },
      { name: 'zona', label: 'Zona o gruppo', placeholder: 'Es. Bagno, Cucina, Professionisti', suggestions: zoneSuggestions(cost?.propertyId ?? propertyId), hint: 'Raggruppa le spese nella scheda dell’immobile: una tendina per ogni zona.' },
      { name: 'categoria', label: 'Categoria', type: 'select', options: CATEGORIE_COSTO },
      { name: 'supplierId', label: 'Fornitore', type: 'select', options: supplierOptions, placeholder: 'Nessun fornitore', allowNew: { label: 'Nuovo fornitore', create: () => openSupplierForm() } },
      { name: 'importo', label: 'Importo', type: 'money', required: true, half: true },
      ...(basiPercentuale.length ? [
        { name: 'baseCalcolo', label: 'Oppure percentuale su', type: 'select', half: true, transient: true, noEmpty: true, options: basiPercentuale },
        { name: 'percentuale', label: 'Percentuale', type: 'percent', half: true, transient: true, linkedTo: 'importo',
          baseField: 'baseCalcolo', baseValues: { acquisto: property?.prezzoAcquisto || 0, vendita: prezzoVendita },
          hint: 'Utile per la provvigione dell’agenzia: scrivi la percentuale e l’importo si calcola da solo.' },
      ] : []),
      { name: 'iva', label: 'IVA', type: 'select', cast: 'number', options: ALIQUOTE_IVA, half: true, noEmpty: true },
      { name: 'data', label: 'Data', type: 'date' },
      { name: 'link', label: 'Link al documento', type: 'url', placeholder: 'https://…', hint: 'Facoltativo: il link al preventivo o alla fattura salvati su Drive, Dropbox o iCloud.' },
      { name: 'note', label: 'Note', type: 'textarea' },
    ],
    onSubmit: values => {
      const normalized = { ...values, iva: values.iva ?? 0 };
      return cost ? (updateCost(id, normalized), id) : addCost(normalized).id;
    },
    onDelete: cost && (() => deleteCost(id)),
    deleteMessage: `Eliminare “${cost?.descrizione}” e i suoi pagamenti? L’operazione non si può annullare.`,
  });
}

/* ── Pagamento (acconto, SAL, saldo) ────────────────────────────────────── */

export function openPaymentForm(costId, paymentId) {
  const cost = getCost(costId);
  const payment = paymentId ? cost.pagamenti.find(p => p.id === paymentId) : null;
  const total = costTotal(cost);
  const balance = costUnallocated(cost, paymentId);

  return openForm({
    title: payment ? 'Modifica pagamento' : 'Nuovo pagamento',
    values: payment
      ? { ...payment, percentuale: total > 0 ? round2((payment.importo / total) * 100) : null }
      : { pagato: true, data: todayISO() },
    fields: [
      { name: 'nota', label: 'Descrizione', placeholder: 'Es. Acconto', suggestions: ['Acconto', 'SAL', 'Saldo'] },
      { name: 'importo', label: 'Importo', type: 'money', required: true, half: true },
      { name: 'percentuale', label: 'Percentuale', type: 'percent', half: true, transient: true, linkedTo: 'importo', base: total,
        quickTarget: 'importo',
        quick: [
          { label: '30%', value: round2(total * 0.3) },
          { label: '50%', value: round2(total * 0.5) },
          ...(balance > 0 ? [{ label: `Saldo ${euro(balance)}`, value: balance }] : []),
        ],
      },
      { type: 'note', text: `Scrivi la cifra o la percentuale: l’altra si aggiorna da sola. Totale ${euro(total)}${balance < total ? `, ancora da assegnare ${euro(balance)}` : ''}.` },
      { name: 'data', label: 'Data', type: 'date', hint: 'Il giorno del pagamento, o la scadenza se è ancora da fare.' },
      { name: 'pagato', label: 'Già pagato', type: 'checkbox', hint: 'Lascia vuoto per programmarlo come scadenza.' },
    ],
    onSubmit: values => (payment ? (updatePayment(costId, paymentId, values), paymentId) : addPayment(costId, values).id),
    onDelete: payment && (() => deletePayment(costId, paymentId)),
    deleteMessage: 'Eliminare questo pagamento?',
  });
}
