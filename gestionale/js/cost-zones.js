// Elenco delle spese raggruppato per zona: ogni zona è una tendina con il riepilogo (pagato e da saldare) sempre in vista
// e, aprendola, le singole voci. Pura: la usano il gestionale e l'area dell'investitore.

import { html } from './dom.js';
import { icon } from './icons.js';
import { euro } from './format.js';
import { groupByZone, zoneOf } from './calc.js';
import { bar } from './ui-parts.js';

/* all: tutte le spese (per i totali di zona); shown: quelle da mostrare dentro le tendine (per esempio dopo un filtro);
   renderCost: come si disegna una voce; openKeys: le tendine aperte; scope: prefisso della chiave (di solito l'immobile). */
export function costZones({ all, shown = all, renderCost, openKeys, scope }) {
  const visible = new Set(shown.map(zoneOf));
  const groups = groupByZone(all).filter(group => visible.has(group.zone));

  return html`
    <div class="zones">
      ${groups.map(group => {
        const key = `${scope}::${group.zone}`;
        const items = shown.filter(cost => zoneOf(cost) === group.zone);
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
