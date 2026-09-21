import { html } from '../dom.js';
import { icon } from '../icons.js';
import { euro, daysFromToday } from '../format.js';
import { openPayments, overallTotals, propertySummary } from '../calc.js';
import { bar, paymentRow, rootBar } from '../components.js';
import { state } from '../store.js';
import { backupIsStale } from './settings.js';
import { propertyCard } from './properties.js';

const UPCOMING = 5;

function welcome() {
  return html`
    <section class="welcome">
      <img class="welcome__mark" src="../images/n-dot.svg" alt="">
      <p class="eyebrow">Benvenuto</p>
      <h1 class="page-title">Tutti i tuoi immobili, in un posto solo.</h1>
      <p class="lead">Registra immobili, fornitori, spese e acconti. Quello che oggi sta tra messaggi, fogli di calcolo e cartelle, qui è ordinato e sempre a portata di mano.</p>
      <div class="btn-row">
        <button type="button" class="btn btn--primary" data-action="new-property">${icon('plus', 20)}Aggiungi il primo immobile</button>
        <button type="button" class="btn btn--outline" data-action="load-demo">Prova con dati di esempio</button>
      </div>
    </section>`;
}


export function dashboardView() {
  const { properties, costs } = state();
  if (!properties.length) return { topbar: rootBar(), body: welcome() };

  const totals = overallTotals(properties, costs);
  const open = openPayments(costs);
  const overdue = open.filter(({ payment }) => payment.data && daysFromToday(payment.data) < 0).length;
  const active = properties.filter(p => p.stato !== 'venduto');

  const body = html`
    ${backupIsStale() && html`<div class="alert">${icon('alert', 20)}<p>Non fai un backup da un po’. I dati sono salvati solo su questo dispositivo: <a href="#/altro">esegui un backup</a>.</p></div>`}
    <p class="eyebrow">Oggi</p>
    <h1 class="page-title">Panoramica</h1>

    <div class="section">
      <div class="hero-card">
        <span class="label">Totale ancora da versare</span>
        <span class="hero-card__value">${euro(totals.daPagare)}</span>
        ${bar(totals.pagato, totals.totale, { onDark: true, label: 'Quota pagata sul totale delle spese' })}
        <p class="hero-card__foot">${euro(totals.pagato)} già pagati su ${euro(totals.totale)} di spese</p>
      </div>
      <div class="kpis">
        <div class="kpi"><span class="label">Immobili attivi</span><span class="kpi__value">${totals.attivi}</span></div>
        <div class="kpi"><span class="label">Voci di spesa</span><span class="kpi__value">${totals.voci}</span></div>
        <div class="kpi"><span class="label">Spese totali</span><span class="kpi__value">${euro(totals.totale)}</span></div>
      </div>
    </div>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Prossimi pagamenti</h2>
        <a class="btn btn--outline btn--sm" href="#/pagamenti">Vedi tutti</a>
      </div>
      ${overdue > 0 && html`<p class="footnote">${overdue === 1 ? '1 pagamento è scaduto' : `${overdue} pagamenti sono scaduti`}.</p>`}
      ${open.length
        ? html`<div class="list">${open.slice(0, UPCOMING).map(paymentRow)}</div>`
        : html`<p class="muted">Nessun pagamento in programma. Aggiungi le scadenze dalla scheda di una spesa.</p>`}
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Immobili in corso</h2>
        <a class="btn btn--outline btn--sm" href="#/immobili">Tutti</a>
      </div>
      ${active.length
        ? active.map(p => propertyCard(p, propertySummary(p, costs)))
        : html`<p class="muted">Tutti gli immobili risultano venduti.</p>`}
    </section>`;

  return { topbar: rootBar(), body };
}
