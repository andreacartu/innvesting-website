import { html } from '../dom.js';
import { icon } from '../icons.js';
import { euro } from '../format.js';
import { groupBySupplier, payState, propertyCode, propertySummary } from '../calc.js';
import { TIPI_FORNITORE, labelOf } from '../labels.js';
import { bar, costRow, detailBar, emptyState, filterChips, propertyStatusBadge, rootBar } from '../components.js';
import { registerActions, toast } from '../actions.js';
import { openCostForm, openPropertyForm } from '../editors.js';
import { getProperty, state } from '../store.js';
import { summaryStats } from '../summary.js';
import { updatesTab } from './updates.js';
import { shareStatusLabel } from '../cloud.js';
import { ui } from '../ui-state.js';

const PROPERTY_FILTERS = [
  { value: 'attivi', label: 'In corso' },
  { value: 'tutti', label: 'Tutti' },
  { value: 'venduti', label: 'Venduti' },
];

const COST_FILTERS = [
  { value: 'tutti', label: 'Tutti' },
  { value: 'da-saldare', label: 'Da saldare' },
  { value: 'saldato', label: 'Saldati' },
];

const matchesCostFilter = (cost, filter) => {
  switch (filter) {
    case 'da-saldare': return payState(cost) !== 'saldato';
    case 'saldato': return payState(cost) === 'saldato';
    default: return true;
  }
};

/* ── Elenco ─────────────────────────────────────────────────────────────── */

export function propertyCard(property, summary) {
  const over = summary.budget > 0 && summary.lavori > summary.budget;
  return html`
    <a class="card property-card" href="#/immobili/${property.id}">
      ${property.photoId && html`<div class="property-card__photo" data-photo-frame><img data-photo="${property.photoId}" alt="Foto esterna di ${property.nome}"></div>`}
      <div class="property-card__head"><span class="code">${propertyCode(property)}</span>${propertyStatusBadge(property)}</div>
      <h3 class="property-card__name">${property.nome}</h3>
      ${property.indirizzo && html`<p class="property-card__place">${property.indirizzo}</p>`}
      <div class="property-card__figures">
        <div><span class="label">Spese lavori</span><strong>${euro(summary.lavori)}</strong></div>
        <div><span class="label">Da pagare</span><strong>${euro(summary.daPagare)}</strong></div>
        ${summary.margine !== null && html`<div><span class="label">${summary.ricavoEffettivo ? 'Margine' : 'Margine stimato'}</span><strong>${euro(summary.margine)}</strong></div>`}
      </div>
      ${summary.budget > 0 && bar(summary.lavori, summary.budget, { over, label: 'Budget lavori utilizzato' })}
    </a>`;
}

export function propertiesView() {
  const { properties, costs } = state();
  const filter = ui.propertyFilter;
  const shown = properties.filter(p => filter === 'tutti' || (filter === 'venduti') === (p.stato === 'venduto'));

  const body = html`
    <div class="page-head">
      <div><p class="eyebrow">Portafoglio</p><h1 class="page-title">Immobili</h1></div>
      <button type="button" class="btn btn--primary btn--sm" data-action="new-property">${icon('plus', 18)}Nuovo</button>
    </div>
    ${properties.length > 0 && filterChips('propertyFilter', filter, PROPERTY_FILTERS)}
    ${shown.length
      ? shown.map(p => propertyCard(p, propertySummary(p, costs)))
      : emptyState(
          properties.length ? 'Nessun immobile in questa vista' : 'Nessun immobile',
          properties.length ? 'Cambia filtro per vedere gli altri.' : 'Aggiungi il primo immobile per iniziare a registrare costi e pagamenti.',
          properties.length ? '' : html`<button type="button" class="btn btn--primary" data-action="new-property">${icon('plus', 20)}Nuovo immobile</button>`
        )}`;

  return { topbar: rootBar(), body };
}

/* ── Scheda immobile ────────────────────────────────────────────────────── */

function costsTab(property, summary) {
  if (ui.costFilterFor !== property.id) { ui.costFilterFor = property.id; ui.costFilter = 'tutti'; }
  const shown = summary.costs.filter(c => matchesCostFilter(c, ui.costFilter));

  return html`
    <div class="section__head">
      <h2 class="section__title">Costi</h2>
      <button type="button" class="btn btn--primary btn--sm" data-action="new-cost" data-property="${property.id}">${icon('plus', 18)}Nuovo</button>
    </div>
    ${summary.costs.length > 0 && filterChips('costFilter', ui.costFilter, COST_FILTERS)}
    ${shown.length
      ? html`<div class="list">${shown.map(c => costRow(c))}</div>`
      : emptyState(
          summary.costs.length ? 'Nessun costo in questa vista' : 'Ancora nessun costo',
          summary.costs.length ? 'Cambia filtro per vedere gli altri.' : 'Registra le spese: fornitore, importo, acconti versati e quanto manca al saldo.'
        )}`;
}

function suppliersTab(_property, summary) {
  const groups = groupBySupplier(summary.costs, state().suppliers);
  if (!groups.length) return emptyState('Nessun fornitore', 'Compaiono qui man mano che li associ ai costi di questo immobile.');

  return html`
    <div class="section__head"><h2 class="section__title">Per fornitore</h2></div>
    <div class="list">
      ${groups.map(g => {
        const inner = html`
          <div class="row__body">
            <div class="row__top"><span class="row__title">${g.supplier?.nome ?? 'Senza fornitore'}</span><span class="row__amount">${euro(g.totale)}</span></div>
            <div class="row__meta">${[g.supplier?.tipo && labelOf(TIPI_FORNITORE, g.supplier.tipo), `${g.costs.length} ${g.costs.length === 1 ? 'voce' : 'voci'}`].filter(Boolean).join(' · ')}</div>
            <div class="row__foot"><span>Pagato <strong>${euro(g.pagato)}</strong></span><span>Manca <strong>${euro(g.totale - g.pagato)}</strong></span></div>
            ${g.totale > 0 && bar(g.pagato, g.totale, { label: 'Importo pagato' })}
          </div>`;
        return g.supplier
          ? html`<a class="row" href="#/fornitori/${g.supplier.id}">${inner}${icon('chevron-right')}</a>`
          : html`<div class="row">${inner}</div>`;
      })}
    </div>`;
}

function infoTab(property, summary) {
  const rows = [
    ['Indirizzo o zona', property.indirizzo],
    ['Cliente', property.cliente],
    ['Investitore', property.investitoreNome],
    ['Email investitore', property.investitoreEmail],
    ['Avanzamento lavori', property.avanzamento ? `${property.avanzamento}%` : ''],
    ['Prezzo di acquisto', property.prezzoAcquisto ? euro(property.prezzoAcquisto) : ''],
    ['Spese di acquisto', property.speseAcquisto ? euro(property.speseAcquisto) : ''],
    ['Budget lavori', summary.budget ? euro(summary.budget) : ''],
    ['Rivendita obiettivo', property.prezzoObiettivo ? euro(property.prezzoObiettivo) : ''],
    ['Vendita effettiva', property.prezzoVendita ? euro(property.prezzoVendita) : ''],
  ].filter(([, value]) => value);

  return html`
    <div class="section__head">
      <h2 class="section__title">Dati</h2>
      <button type="button" class="btn btn--outline btn--sm" data-action="edit-property" data-id="${property.id}">${icon('edit', 16)}Modifica</button>
    </div>
    <dl class="details">${rows.map(([label, value]) => html`<div class="details__row"><dt>${label}</dt><dd>${value}</dd></div>`)}</dl>
    ${property.note && html`<div class="section"><p class="label">Note</p><div class="notes">${property.note}</div></div>`}`;
}

export function propertyView(id, tab = 'costi') {
  const property = getProperty(id);
  if (!property) return null;
  const summary = propertySummary(property, state().costs);

  const tabs = [['costi', 'Costi'], ['aggiornamenti', 'Lavori'], ['fornitori', 'Fornitori'], ['info', 'Dati']];
  const content = { costi: costsTab, aggiornamenti: updatesTab, fornitori: suppliersTab, info: infoTab }[tab](property, summary);

  const body = html`
    ${property.photoId && html`<div class="cover" data-photo-frame><img data-photo="${property.photoId}" alt="Foto esterna di ${property.nome}"></div>`}
    <div class="property-card__head"><span class="code">${propertyCode(property)}</span>${propertyStatusBadge(property)}</div>
    <h1 class="page-title">${property.nome}</h1>
    ${property.indirizzo && html`<p class="lead">${property.indirizzo}</p>`}
    ${(property.cliente || property.investitoreNome) && html`
      <dl class="people">
        ${property.cliente && html`<div><dt class="label">Cliente</dt><dd>${property.cliente}</dd></div>`}
        ${property.investitoreNome && html`<div><dt class="label">Investitore</dt><dd>${property.investitoreNome}</dd></div>`}
      </dl>`}
    ${property.condiviso && html`
      <p class="share-status">${shareStatusLabel(property)}</p>
      <button type="button" class="btn btn--outline btn--sm share-invite" data-action="invite-investor" data-id="${property.id}">${icon('message', 16)}Invia invito all’investitore</button>`}
    ${summaryStats(property, summary)}
    <nav class="tabs" aria-label="Sezioni dell’immobile">
      ${tabs.map(([key, label]) => html`<a class="tabs__item" href="#/immobili/${property.id}/${key}" ${key === tab && html`aria-current="page"`}>${label}</a>`)}
    </nav>
    ${content}`;

  return {
    topbar: detailBar({ title: `${propertyCode(property)} · ${property.nome}`, back: '#/immobili', action: { name: 'edit-property', data: html`data-id="${property.id}"`, icon: 'edit', label: 'Modifica immobile' } }),
    body,
  };
}

registerActions({
  'new-property': async () => {
    const id = await openPropertyForm();
    if (typeof id === 'string') location.hash = `#/immobili/${id}`;
  },
  'edit-property': async el => {
    const result = await openPropertyForm(el.dataset.id);
    if (result?.deleted) { location.hash = '#/immobili'; toast('Immobile eliminato'); }
  },
  // Il messaggio non parte da solo: si apre il foglio di condivisione (WhatsApp, Messaggi, Mail) con testo e link già pronti.
  'invite-investor': async el => {
    const property = getProperty(el.dataset.id);
    const link = new URL('investitore.html', location.href).href;
    const name = property.investitoreNome ? ` ${property.investitoreNome.split(' ')[0]}` : '';
    const text = `Ciao${name}, da qui puoi seguire in tempo reale i lavori del tuo immobile (${property.nome}): avanzamento, foto, spese e pagamenti.\n\nApri il link e accedi con questa email: ${property.investitoreEmail}. Ti arriva un codice per entrare, senza password.\n${link}`;
    try {
      if (navigator.share) await navigator.share({ title: 'INNvesting: il tuo investimento', text });
      else { await navigator.clipboard.writeText(text); toast('Invito copiato: incollalo dove vuoi inviarlo'); }
    } catch (error) {
      if (error.name !== 'AbortError') toast('Non è stato possibile preparare l’invito');
    }
  },
  'new-cost': async el => {
    if (!state().properties.length) { toast('Aggiungi prima un immobile'); return; }
    const id = await openCostForm({ propertyId: el.dataset.property });
    if (typeof id === 'string') toast('Costo aggiunto');
  },
});
