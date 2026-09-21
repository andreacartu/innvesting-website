// Elenco delle spese raggruppato per zona: ogni zona è una tendina con il riepilogo (pagato e da saldare) sempre in vista
// e, aprendola, le singole voci. Pura: la usano il gestionale e l'area dell'investitore.

import { html } from './dom.js';
import { icon } from './icons.js';
import { euro } from './format.js';
import { groupByZone } from './calc.js';
import { bar } from './ui-parts.js';

/* costs: le spese da mostrare (già filtrate, se c'è un filtro): i totali di ogni zona si calcolano su queste,
   così "Da saldare" e "Saldati" mostrano numeri diversi. renderCost: come si disegna una voce;
   openKeys: le tendine aperte; scope: prefisso della chiave (di solito l'immobile). */
export function costZones({ costs, renderCost, openKeys, scope }) {
  const groups = groupByZone(costs);

  return html`
    <div class="zones">
      ${groups.map(group => {
        const key = `${scope}::${group.zone}`;
        const items = group.costs;
        return html`
          <details class="zone" data-zone="${key}" ${openKeys.has(key) && html`open`}>
            <summary class="zone__head">
              <div class="zone__body">
                <div class="zone__top"><span class="zone__name">${group.zone}</span><span class="zone__amount">${euro(group.totale)}</span></div>
                <div class="zone__foot">
                  <span>${group.costs.length} ${group.costs.length === 1 ? 'voce' : 'voci'}</span>
                  <span>Pagato <strong>${euro(group.pagato)}</strong></span>
                  <span>Da saldare <strong>${euro(group.daSaldare)}</strong></span>
                </div>
                ${bar(group.pagato, group.totale, { label: `Importo pagato in ${group.zone}` })}
              </div>
              <span class="zone__chevron">${icon('chevron-right')}</span>
            </summary>
            <div class="list zone__items">${items.map(renderCost)}</div>
          </details>`;
      })}
    </div>`;
}

/* Ricorda quali tendine sono aperte, così un aggiornamento dei dati non le richiude. */
const bound = new WeakSet();

export function rememberOpenZones(root, openKeys) {
  if (bound.has(root)) return; // il contenitore resta lo stesso a ogni ridisegno: l'ascoltatore si aggiunge una volta sola
  bound.add(root);
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (!details.matches?.('details.zone')) return;
    if (details.open) openKeys.add(details.dataset.zone);
    else openKeys.delete(details.dataset.zone);
  }, true);
}
