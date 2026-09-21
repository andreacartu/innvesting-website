// Pezzi di interfaccia riusati da più schermate.

import { html } from './dom.js';
import { badge, bar } from './ui-parts.js';
import { icon } from './icons.js';
import { euro, formatDate, dueLabel, daysFromToday } from './format.js';
import { CATEGORIE_COSTO, STATI_IMMOBILE, labelOf } from './labels.js';
import { costPaid, costRemaining, costTotal, payState, propertyCode } from './calc.js';
import { getProperty, getSupplier } from './store.js';

export { badge, bar };

/* ── Barra superiore ────────────────────────────────────────────────────── */

export const rootBar = () => html`
  <a class="topbar__brand" href="#/" aria-label="INNvesting, panoramica"><img class="topbar__logo" src="../images/logo-innvesting.png" alt="INNvesting"></a>
  <span class="topbar__spacer"></span>
  <span class="topbar__tag">Gestionale</span>`;

export const detailBar = ({ title, back, action }) => html`
  <a class="icon-btn" href="${back}" aria-label="Indietro">${icon('chevron-left', 24)}</a>
  <span class="topbar__title">${title}</span>
  <span class="topbar__spacer"></span>
  ${action && html`<button type="button" class="icon-btn icon-btn--end" data-action="${action.name}" ${action.data} aria-label="${action.label}">${icon(action.icon)}</button>`}`;

/* ── Elementi base ──────────────────────────────────────────────────────── */

export const filterChips = (key, current, options) => html`
  <div class="chips" role="group">
    ${options.map(o => html`<button type="button" class="chip" data-action="set-filter" data-key="${key}" data-value="${o.value}" aria-pressed="${o.value === current}">${o.label}</button>`)}
  </div>`;

export const emptyState = (title, text, button = '') => html`
  <div class="empty">
    <img class="empty__mark" src="../images/n-dot.svg" alt="">
    <p class="empty__title">${title}</p>
    <p>${text}</p>
    ${button && html`<div class="btn-row section">${button}</div>`}
  </div>`;

/* ── Immobili ───────────────────────────────────────────────────────────── */

export const propertyStatusBadge = property => badge(labelOf(STATI_IMMOBILE, property.stato));

/* ── Costi e pagamenti ──────────────────────────────────────────────────── */

export function payBadge(cost) {
  switch (payState(cost)) {
    case 'saldato': return badge('Saldato', 'paid', 'check');
    case 'acconto': return badge('Acconto versato', 'partial');
    default: return badge('Da pagare', 'due');
  }
}

export function costRow(cost, { showProperty = false, showSupplier = true } = {}) {
  const property = showProperty ? getProperty(cost.propertyId) : null;
  const supplier = showSupplier ? getSupplier(cost.supplierId) : null;
  const total = costTotal(cost);
  const paid = costPaid(cost);
  const meta = [property && propertyCode(property), supplier?.nome, labelOf(CATEGORIE_COSTO, cost.categoria)].filter(Boolean).join(' · ');

  return html`
    <a class="row" href="#/costi/${cost.id}">
      <div class="row__body">
        <div class="row__top"><span class="row__title">${cost.descrizione}</span><span class="row__amount">${euro(total)}</span></div>
        ${meta && html`<div class="row__meta">${meta}</div>`}
        <div class="row__foot">${payBadge(cost)}<span>Pagato <strong>${euro(paid)}</strong></span><span>Manca <strong>${euro(costRemaining(cost))}</strong></span></div>
        ${bar(paid, total, { label: 'Importo pagato' })}
      </div>
      ${icon('chevron-right')}
    </a>`;
}

export function paymentRow({ cost, payment }) {
  const property = getProperty(cost.propertyId);
  const supplier = getSupplier(cost.supplierId);
  const late = !payment.pagato && payment.data && daysFromToday(payment.data) < 0;
  const meta = [property && propertyCode(property), supplier?.nome, cost.descrizione].filter(Boolean).join(' · ');
  const when = payment.pagato
    ? formatDate(payment.data)
    : payment.data ? html`<span class="due ${late && 'due--late'}">${formatDate(payment.data)} · ${dueLabel(payment.data)}</span>` : 'Senza data';

  return html`
    <div class="row">
      <button type="button" class="check-btn ${payment.pagato && 'is-done'}" data-action="toggle-payment" data-cost="${cost.id}" data-payment="${payment.id}"
        aria-label="${payment.pagato ? 'Segna come da pagare' : 'Segna come pagato'}">${icon(payment.pagato ? 'check-circle' : 'circle', 26)}</button>
      <a class="row__body" href="#/costi/${cost.id}">
        <div class="row__top"><span class="row__title">${payment.nota || 'Pagamento'}</span><span class="row__amount">${euro(payment.importo)}</span></div>
        <div class="row__meta">${meta}</div>
        <div class="row__foot">${when}</div>
      </a>
    </div>`;
}
