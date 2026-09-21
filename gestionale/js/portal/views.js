// Schermate dell'area dell'investitore: funzioni pure che trasformano la copia condivisa di un immobile in HTML.
// Tutto in sola lettura; le foto arrivano già come indirizzi firmati (`photoUrl`).

import { html } from '../dom.js';
import { icon } from '../icons.js';
import { euro, formatDate } from '../format.js';
import { costPaid, costRemaining, costTotal, groupBySupplier, payState, propertyCode, propertySummary } from '../calc.js';
import { CATEGORIE_COSTO, STATI_IMMOBILE, TIPI_FORNITORE, labelOf } from '../labels.js';
import { badge, bar } from '../ui-parts.js';
import { summaryStats } from '../summary.js';
import { updatesTimeline } from '../timeline.js';
import { costZones } from '../cost-zones.js';

export const TABS = [['aggiornamenti', 'Lavori'], ['spese', 'Spese'], ['imprese', 'Imprese']];

/* Ricostruisce, dalla copia condivisa, gli oggetti che i calcoli si aspettano (con id e propertyId). */
export function unpack(row) {
  const { snapshot } = row;
  const property = { ...snapshot.property, id: row.id };
  const costs = snapshot.costs.map(c => ({ ...c, propertyId: row.id }));
  return { property, costs, suppliers: snapshot.suppliers, updates: snapshot.updates, summary: propertySummary(property, costs) };
}

const remotePhoto = (row, photoUrl) => id => html`<img src="${photoUrl(row.id, id)}" alt="Foto del cantiere" loading="lazy">`;

/* ── Accesso ────────────────────────────────────────────────────────────── */

export function loginView({ step, email = '', message = '' }) {
  return html`
    <section class="portal-login">
      <p class="eyebrow">Area riservata</p>
      <h1 class="page-title">Il tuo investimento, aggiornato in tempo reale.</h1>
      <p class="lead">${step === 'code'
        ? `Abbiamo scritto a ${email}: apri l’email e digita qui il codice.`
        : 'Inserisci l’email con cui sei stato invitato. Ti inviamo un codice per entrare, senza password.'}</p>
      <form class="portal-login__form" data-form="${step}" novalidate>
        ${step === 'code'
          ? html`<label class="field__label" for="portal-code">Codice</label><input class="field__input" id="portal-code" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required>`
          : html`<label class="field__label" for="portal-email">La tua email</label><input class="field__input" id="portal-email" name="email" type="email" autocomplete="email" placeholder="nome@email.it" required>`}
        <p class="portal-login__message" role="status">${message}</p>
        <button type="submit" class="btn btn--primary btn--block">${step === 'code' ? 'Entra' : 'Invia il codice'}</button>
        ${step === 'code' && html`<button type="button" class="lock__link portal-login__back" data-action="portal-restart">Usa un’altra email</button>`}
      </form>
    </section>`;
}

/* ── Elenco immobili ────────────────────────────────────────────────────── */

export function listView(rows, photoUrl) {
  return html`
    <p class="eyebrow">I tuoi immobili</p>
    <h1 class="page-title">Ciao${rows[0]?.snapshot.property.investitoreNome ? `, ${rows[0].snapshot.property.investitoreNome}` : ''}</h1>
    <div class="section">
      ${rows.map(row => {
        const { property, summary } = unpack(row);
        const url = property.photoId && photoUrl(row.id, property.photoId);
        return html`
          <a class="card property-card" href="#/p/${row.id}/aggiornamenti">
            ${url && html`<div class="property-card__photo"><img src="${url}" alt="Foto esterna di ${property.nome}" loading="lazy"></div>`}
            <div class="property-card__head"><span class="code">${propertyCode(property)}</span>${badge(labelOf(STATI_IMMOBILE, property.stato))}</div>
            <h3 class="property-card__name">${property.nome}</h3>
            ${property.indirizzo && html`<p class="property-card__place">${property.indirizzo}</p>`}
            <div class="property-card__figures">
              <div><span class="label">Avanzamento</span><strong>${property.avanzamento}%</strong></div>
              <div><span class="label">Già pagato</span><strong>${euro(summary.pagato)}</strong></div>
            </div>
            ${bar(property.avanzamento, 100, { label: 'Avanzamento dei lavori' })}
          </a>`;
      })}
    </div>`;
}

/* ── Scheda immobile ────────────────────────────────────────────────────── */

function costItem(cost) {
  const total = costTotal(cost);
  const paid = costPaid(cost);
  const state = payState(cost);
  const payments = [...cost.pagamenti].sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));

  return html`
    <details class="cost-item">
      <summary class="row">
        <div class="row__body">
          <div class="row__top"><span class="row__title">${cost.descrizione}</span><span class="row__amount">${euro(total)}</span></div>
          ${cost.categoria && html`<div class="row__meta">${labelOf(CATEGORIE_COSTO, cost.categoria)}</div>`}
          <div class="row__foot">${state === 'saldato' ? badge('Saldato', 'paid', 'check') : state === 'acconto' ? badge('Acconto versato', 'partial') : badge('Da pagare', 'due')}<span>Pagato <strong>${euro(paid)}</strong></span><span>Manca <strong>${euro(costRemaining(cost))}</strong></span></div>
          ${bar(paid, total, { label: 'Importo pagato' })}
        </div>
        <span class="cost-item__chevron">${icon('chevron-right')}</span>
      </summary>
      ${payments.length > 0 && html`
        <ul class="pay-list">
          ${payments.map(p => html`<li><span>${p.nota || 'Pagamento'}${p.data && html` · ${formatDate(p.data)}`}</span><span>${euro(p.importo)} ${p.pagato ? badge('Pagato', 'paid') : badge('Da pagare')}</span></li>`)}
        </ul>`}
    </details>`;
}

const updatesSection = (row, data, photoUrl) => data.updates.length
  ? updatesTimeline(data.updates, { photo: remotePhoto(row, photoUrl) })
  : html`<div class="empty"><p class="empty__title">Nessun aggiornamento, per ora</p><p>Qui compariranno le novità del cantiere, con le foto, man mano che i lavori procedono.</p></div>`;

const costsSection = (row, data, openZones) => data.costs.length
  ? html`${costZones({ costs: data.costs, renderCost: costItem, openKeys: openZones, scope: row.id })}<p class="footnote">Gli importi comprendono l’IVA. Apri una zona per vedere le voci e tocca una voce per vedere acconti e saldi.</p>`
  : html`<p class="muted">Nessuna spesa registrata, per ora.</p>`;

function suppliersSection(data) {
  const groups = groupBySupplier(data.costs, data.suppliers);
  if (!groups.length) return html`<p class="muted">Nessuna impresa registrata, per ora.</p>`;
  return html`<div class="list">${groups.map(g => html`
    <div class="row">
      <div class="row__body">
        <div class="row__top"><span class="row__title">${g.supplier?.nome ?? 'Altre voci'}</span><span class="row__amount">${euro(g.totale)}</span></div>
        <div class="row__meta">${[g.supplier?.tipo && labelOf(TIPI_FORNITORE, g.supplier.tipo), `${g.costs.length} ${g.costs.length === 1 ? 'voce' : 'voci'}`].filter(Boolean).join(' · ')}</div>
        <div class="row__foot"><span>Pagato <strong>${euro(g.pagato)}</strong></span><span>Manca <strong>${euro(g.totale - g.pagato)}</strong></span></div>
      </div>
    </div>`)}</div>`;
}

export function detailView(row, tab, photoUrl, openZones = new Set()) {
  const data = unpack(row);
  const { property } = data;
  const cover = property.photoId && photoUrl(row.id, property.photoId);
  const content = { aggiornamenti: updatesSection(row, data, photoUrl), spese: costsSection(row, data, openZones), imprese: suppliersSection(data) }[tab] ?? '';

  return html`
    ${cover && html`<div class="cover"><img src="${cover}" alt="Foto esterna di ${property.nome}"></div>`}
    <div class="property-card__head"><span class="code">${propertyCode(property)}</span>${badge(labelOf(STATI_IMMOBILE, property.stato))}</div>
    <h1 class="page-title">${property.nome}</h1>
    ${property.indirizzo && html`<p class="lead">${property.indirizzo}</p>`}

    <div class="card card--sand progress-card">
      <span class="label">Avanzamento dei lavori</span>
      <span class="big-figure">${property.avanzamento}%</span>
      ${bar(property.avanzamento, 100, { label: 'Avanzamento dei lavori' })}
    </div>

    ${summaryStats(property, data.summary)}

    <nav class="tabs" aria-label="Sezioni">
      ${TABS.map(([key, label]) => html`<a class="tabs__item" href="#/p/${row.id}/${key}" ${key === tab && html`aria-current="page"`}>${label}</a>`)}
    </nav>
    ${content}`;
}
