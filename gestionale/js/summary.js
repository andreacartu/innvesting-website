// Riepilogo economico di un immobile (margine, investimento, spese, pagato). Puro: lo usano il gestionale e l'area dell'investitore.

import { html } from './dom.js';
import { euro, percent } from './format.js';
import { bar } from './ui-parts.js';

const stat = (label, value, note = '') => html`
  <div class="stat"><span class="label">${label}</span><span class="stat__value">${value}</span>${note && html`<span class="stat__note">${note}</span>`}</div>`;

export function summaryStats(property, s) {
  const over = s.budget > 0 && s.lavori > s.budget;
  const marginLabel = s.ricavoEffettivo ? 'Margine realizzato' : 'Margine stimato';
  const marginNote = s.margine === null
    ? 'Disponibile quando è indicato il prezzo di rivendita'
    : `${s.marginePct !== null ? `${percent(s.marginePct)} sull’investimento · ` : ''}rivendita ${euro(s.ricavo)}, prima di compenso e imposte`;

  return html`
    <div class="stats">
      <div class="stat stat--wide stat--dark"><span class="label">${marginLabel}</span><span class="stat__value">${s.margine === null ? '—' : euro(s.margine)}</span><span class="stat__note">${marginNote}</span></div>
      ${stat('Investimento totale', euro(s.investimento), 'Acquisto e spese lavori')}
      ${stat('Acquisto', euro(s.acquisto), property.speseAcquisto ? `di cui spese ${euro(property.speseAcquisto)}` : '')}
      <div class="stat stat--wide">
        <span class="label">Spese lavori</span><span class="stat__value">${euro(s.lavori)}</span>
        ${s.budget > 0
          ? html`${bar(s.lavori, s.budget, { over, label: 'Budget lavori utilizzato' })}<span class="stat__note">${over ? `${euro(s.lavori - s.budget)} oltre il budget di ${euro(s.budget)}` : `Budget ${euro(s.budget)}, restano ${euro(s.budget - s.lavori)}`}</span>`
          : html`<span class="stat__note">Nessun budget impostato</span>`}
      </div>
      ${stat('Già pagato', euro(s.pagato))}
      ${stat('Da pagare', euro(s.daPagare))}
    </div>`;
}
