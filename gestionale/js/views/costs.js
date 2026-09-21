import { html } from '../dom.js';
import { icon } from '../icons.js';
import { euro, formatDate, percent, todayISO } from '../format.js';
import { costPaid, costRemaining, costScheduled, costTotal, costUnallocated, propertyCode } from '../calc.js';
import { ALIQUOTE_IVA, CATEGORIE_COSTO, labelOf } from '../labels.js';
import { bar, detailBar, payBadge } from '../components.js';
import { registerActions, toast } from '../actions.js';
import { openCostForm, openPaymentForm } from '../editors.js';
import { getCost, getProperty, getSupplier, updatePayment } from '../store.js';

const isWebLink = value => /^https?:\/\//i.test(value ?? '');

function paymentItem(cost, payment) {
  return html`
    <div class="row">
      <button type="button" class="check-btn ${payment.pagato && 'is-done'}" data-action="toggle-payment" data-cost="${cost.id}" data-payment="${payment.id}"
        aria-label="${payment.pagato ? 'Segna come da pagare' : 'Segna come pagato'}">${icon(payment.pagato ? 'check-circle' : 'circle', 26)}</button>
      <button type="button" class="row__body row__body--button" data-action="edit-payment" data-cost="${cost.id}" data-payment="${payment.id}">
        <div class="row__top"><span class="row__title">${payment.nota || 'Pagamento'}</span><span class="row__amount">${euro(payment.importo)}</span></div>
        <div class="row__meta">${payment.pagato ? 'Pagato' : 'Da pagare'}${payment.data && ` · ${formatDate(payment.data)}`}</div>
      </button>
    </div>`;
}

function paymentsSection(cost) {
  const total = costTotal(cost);
  const paid = costPaid(cost);
  const scheduled = costScheduled(cost);
  const unallocated = costUnallocated(cost);
  const payments = [...cost.pagamenti].sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));

  return html`
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Pagamenti</h2>
        <button type="button" class="btn btn--primary btn--sm" data-action="new-payment" data-cost="${cost.id}">${icon('plus', 18)}Registra</button>
      </div>
      <div class="card card--sand">
        <div class="split">
          <div><span class="label">Già pagato</span><span class="big-figure">${euro(paid)}</span></div>
          <div><span class="label">Da saldare</span><span class="big-figure">${euro(costRemaining(cost))}</span></div>
        </div>
        ${bar(paid, total, { label: 'Importo pagato' })}
        <p class="footnote">${percent(total > 0 ? paid / total : 0)} pagato su un totale di ${euro(total)}.${costRemaining(cost) === 0 ? ' Saldato per intero.' : ''}</p>
        ${scheduled > 0 && html`<p class="footnote">${euro(scheduled)} programmati come scadenze.</p>`}
        ${unallocated > 0 && html`<p class="footnote">${euro(unallocated)} non ancora assegnati a un pagamento.</p>`}
      </div>
      ${payments.length
        ? html`<div class="list">${payments.map(p => paymentItem(cost, p))}</div>`
        : html`<p class="footnote">Nessun pagamento registrato. Aggiungi acconti, SAL e saldo, oppure programmali come scadenze.</p>`}
    </section>`;
}

export function costView(id) {
  const cost = getCost(id);
  if (!cost) return null;
  const property = getProperty(cost.propertyId);
  const supplier = getSupplier(cost.supplierId);

  const rows = [
    ['Immobile', property && html`<a href="#/immobili/${property.id}">${propertyCode(property)} · ${property.nome}</a>`],
    ['Fornitore', supplier && html`<a href="#/fornitori/${supplier.id}">${supplier.nome}</a>`],
    ['Categoria', labelOf(CATEGORIE_COSTO, cost.categoria)],
    ['Importo', euro(cost.importo)],
    ['IVA', cost.iva ? `${cost.iva}% (${euro(costTotal(cost) - cost.importo)})` : labelOf(ALIQUOTE_IVA, 0)],
    ['Data', cost.data && formatDate(cost.data)],
    ['Documento', isWebLink(cost.link) && html`<a href="${cost.link}" target="_blank" rel="noopener noreferrer">Apri il link</a>`],
  ].filter(([, value]) => value);

  const body = html`
    <div class="property-card__head">${payBadge(cost)}</div>
    <h1 class="page-title">${cost.descrizione}</h1>
    <p class="lead">Totale ${euro(costTotal(cost))}${cost.iva ? ' IVA inclusa' : ''}</p>

    ${paymentsSection(cost)}

    <section class="section">
      <div class="section__head"><h2 class="section__title">Dettagli</h2></div>
      <dl class="details">${rows.map(([label, value]) => html`<div class="details__row"><dt>${label}</dt><dd>${value}</dd></div>`)}</dl>
      ${cost.note && html`<div class="section"><p class="label">Note</p><div class="notes">${cost.note}</div></div>`}
    </section>`;

  return {
    topbar: detailBar({
      title: cost.descrizione,
      back: property ? `#/immobili/${property.id}` : '#/immobili',
      action: { name: 'edit-cost', data: html`data-id="${cost.id}"`, icon: 'edit', label: 'Modifica costo' },
    }),
    body,
  };
}

registerActions({
  'edit-cost': async el => {
    const cost = getCost(el.dataset.id);
    const result = await openCostForm({ id: el.dataset.id });
    if (result?.deleted) {
      location.hash = cost ? `#/immobili/${cost.propertyId}` : '#/immobili';
      toast('Costo eliminato');
    }
  },
  'new-payment': el => openPaymentForm(el.dataset.cost),
  'edit-payment': el => openPaymentForm(el.dataset.cost, el.dataset.payment),
  'toggle-payment': el => {
    const cost = getCost(el.dataset.cost);
    const payment = cost.pagamenti.find(p => p.id === el.dataset.payment);
    const paid = !payment.pagato;
    const today = todayISO();
    // Se lo segno come pagato e la data è vuota o futura, uso oggi; altrimenti conservo la data indicata.
    updatePayment(cost.id, payment.id, { pagato: paid, data: paid && (!payment.data || payment.data > today) ? today : payment.data });
    toast(paid ? 'Segnato come pagato' : 'Segnato come da pagare');
  },
});
