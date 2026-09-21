import { html } from '../dom.js';
import { icon } from '../icons.js';
import { euro } from '../format.js';
import { costPaid, costTotal, sum } from '../calc.js';
import { TIPI_FORNITORE, labelOf } from '../labels.js';
import { costRow, detailBar, emptyState, rootBar } from '../components.js';
import { registerActions, toast } from '../actions.js';
import { openCostForm, openSupplierForm } from '../editors.js';
import { getSupplier, state } from '../store.js';
import { ui } from '../ui-state.js';

const normalize = text => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function supplierTotals(supplierId) {
  const own = state().costs.filter(c => c.supplierId === supplierId);
  const totale = sum(own.map(costTotal));
  return { totale, pagato: sum(own.map(costPaid)) };
}

function supplierRows(query) {
  const needle = normalize(query.trim());
  const suppliers = [...state().suppliers]
    .filter(s => !needle || normalize([s.nome, s.referente, labelOf(TIPI_FORNITORE, s.tipo)].join(' ')).includes(needle))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

  if (!suppliers.length) {
    return state().suppliers.length
      ? emptyState('Nessun risultato', 'Prova con un altro nome o tipo di fornitore.')
      : emptyState('Nessun fornitore', 'Aggiungi imprese, professionisti e negozi con cui lavori, così li ritrovi su ogni spesa.');
  }

  return html`<div class="list">${suppliers.map(s => {
    const { totale, pagato } = supplierTotals(s.id);
    return html`
      <a class="row" href="#/fornitori/${s.id}">
        <div class="row__body">
          <div class="row__top"><span class="row__title">${s.nome}</span>${totale > 0 && html`<span class="row__amount">${euro(totale)}</span>`}</div>
          <div class="row__meta">${[labelOf(TIPI_FORNITORE, s.tipo), s.referente].filter(Boolean).join(' · ')}</div>
          ${totale > 0 && html`<div class="row__foot"><span>Pagato <strong>${euro(pagato)}</strong></span><span>Manca <strong>${euro(totale - pagato)}</strong></span></div>`}
        </div>
        ${icon('chevron-right')}
      </a>`;
  })}</div>`;
}

export function suppliersView() {
  const body = html`
    <div class="page-head">
      <div><p class="eyebrow">Rete</p><h1 class="page-title">Fornitori</h1></div>
      <button type="button" class="btn btn--primary btn--sm" data-action="new-supplier">${icon('plus', 18)}Nuovo</button>
    </div>
    ${state().suppliers.length > 4 && html`<label class="search">${icon('search', 20)}<input type="search" data-supplier-search placeholder="Cerca per nome o tipo" value="${ui.supplierQuery}" autocomplete="off"></label>`}
    <div id="supplier-list">${supplierRows(ui.supplierQuery)}</div>`;

  return {
    topbar: rootBar(),
    body,
    // La ricerca aggiorna solo l'elenco: ridisegnare tutta la pagina farebbe perdere il focus alla tastiera.
    mount: root => {
      root.querySelector('[data-supplier-search]')?.addEventListener('input', event => {
        ui.supplierQuery = event.target.value;
        root.querySelector('#supplier-list').innerHTML = supplierRows(ui.supplierQuery).value;
      });
    },
  };
}

/* Numero di telefono in formato internazionale per WhatsApp: senza prefisso si assume l'Italia. */
function whatsappNumber(phone) {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  return `39${digits}`;
}

export function supplierView(id) {
  const supplier = getSupplier(id);
  if (!supplier) return null;
  const costs = state().costs.filter(c => c.supplierId === id);
  const { totale, pagato } = supplierTotals(id);

  const body = html`
    <p class="eyebrow">${labelOf(TIPI_FORNITORE, supplier.tipo) || 'Fornitore'}</p>
    <h1 class="page-title">${supplier.nome}</h1>
    ${supplier.referente && html`<p class="lead">${supplier.referente}</p>`}

    ${(supplier.telefono || supplier.email) && html`
      <div class="btn-row section">
        ${supplier.telefono && html`
          <a class="btn btn--dark btn--sm" href="tel:${supplier.telefono.replace(/\s/g, '')}">${icon('phone', 16)}Chiama</a>
          <a class="btn btn--outline btn--sm" href="https://wa.me/${whatsappNumber(supplier.telefono)}" target="_blank" rel="noopener noreferrer">${icon('message', 16)}WhatsApp</a>`}
        ${supplier.email && html`<a class="btn btn--outline btn--sm" href="mailto:${supplier.email}">${icon('mail', 16)}Email</a>`}
      </div>`}

    <div class="kpis section">
      <div class="kpi"><span class="label">Totale</span><span class="kpi__value">${euro(totale)}</span></div>
      <div class="kpi"><span class="label">Pagato</span><span class="kpi__value">${euro(pagato)}</span></div>
      <div class="kpi"><span class="label">Da pagare</span><span class="kpi__value">${euro(totale - pagato)}</span></div>
    </div>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Spese</h2>
        <button type="button" class="btn btn--primary btn--sm" data-action="new-supplier-cost" data-supplier="${supplier.id}">${icon('plus', 18)}Nuovo</button>
      </div>
      ${costs.length
        ? html`<div class="list">${costs.map(c => costRow(c, { showProperty: true, showSupplier: false }))}</div>`
        : emptyState('Nessun costo', 'Non ci sono ancora spese collegate a questo fornitore.')}
    </section>

    ${supplier.note && html`<section class="section"><p class="label">Note</p><div class="notes">${supplier.note}</div></section>`}`;

  return {
    topbar: detailBar({ title: supplier.nome, back: '#/fornitori', action: { name: 'edit-supplier', data: html`data-id="${supplier.id}"`, icon: 'edit', label: 'Modifica fornitore' } }),
    body,
  };
}

registerActions({
  'new-supplier': async () => {
    const id = await openSupplierForm();
    if (typeof id === 'string') location.hash = `#/fornitori/${id}`;
  },
  'new-supplier-cost': async el => {
    if (!state().properties.length) { toast('Aggiungi prima un immobile'); return; }
    if (typeof (await openCostForm({ supplierId: el.dataset.supplier })) === 'string') toast('Costo aggiunto');
  },
  'edit-supplier': async el => {
    const result = await openSupplierForm(el.dataset.id);
    if (result?.deleted) { location.hash = '#/fornitori'; toast('Fornitore eliminato'); }
  },
});
