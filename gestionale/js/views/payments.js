import { html } from '../dom.js';
import { euro, daysFromToday } from '../format.js';
import { costUnallocated, donePayments, openPayments, sum } from '../calc.js';
import { emptyState, filterChips, paymentRow, rootBar } from '../components.js';
import { state } from '../store.js';
import { ui } from '../ui-state.js';

const FILTERS = [
  { value: 'da-pagare', label: 'Da pagare' },
  { value: 'effettuati', label: 'Effettuati' },
];

const HISTORY_LIMIT = 40;

export function paymentsView() {
  const { costs } = state();
  const open = openPayments(costs);
  const overdue = open.filter(({ payment }) => payment.data && daysFromToday(payment.data) < 0);
  const unallocated = sum(costs.map(c => costUnallocated(c)));
  const showingOpen = ui.paymentFilter === 'da-pagare';
  const items = showingOpen ? open : donePayments(costs).slice(0, HISTORY_LIMIT);

  const body = html`
    <p class="eyebrow">Scadenze</p>
    <h1 class="page-title">Pagamenti</h1>

    <div class="kpis section">
      <div class="kpi"><span class="label">Programmati</span><span class="kpi__value">${euro(sum(open.map(({ payment }) => payment.importo)))}</span></div>
      <div class="kpi"><span class="label">Scaduti</span><span class="kpi__value">${euro(sum(overdue.map(({ payment }) => payment.importo)))}</span></div>
      <div class="kpi"><span class="label">Da assegnare</span><span class="kpi__value">${euro(unallocated)}</span></div>
    </div>
    <p class="footnote">“Da assegnare” è la parte delle spese che non ha ancora un acconto o una scadenza.</p>

    <div class="section">${filterChips('paymentFilter', ui.paymentFilter, FILTERS)}
      ${items.length
        ? html`<div class="list">${items.map(paymentRow)}</div>`
        : emptyState(
            showingOpen ? 'Nessun pagamento in programma' : 'Ancora nessun pagamento effettuato',
            showingOpen ? 'Aggiungi acconti e saldi dalla scheda di una spesa.' : 'I pagamenti che segni come effettuati compaiono qui.'
          )}
      ${!showingOpen && donePayments(costs).length > HISTORY_LIMIT && html`<p class="footnote">Mostrati gli ultimi ${HISTORY_LIMIT} pagamenti.</p>`}
    </div>`;

  return { topbar: rootBar(), body };
}
