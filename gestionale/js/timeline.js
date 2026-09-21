// Cronologia degli aggiornamenti di cantiere. Pura: la usano il gestionale (con il tasto Modifica) e l'area dell'investitore.

import { html } from './dom.js';
import { icon } from './icons.js';
import { formatDate } from './format.js';
import { registerActions } from './actions.js';
import { openLightbox } from './ui-parts.js';

/* `photo(id)` decide da dove arriva l'immagine: dal telefono (gestionale) o dall'archivio online (investitore). */
export function updatesTimeline(updates, { photo, editable = false }) {
  const sorted = [...updates].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  return html`
    <ol class="timeline">
      ${sorted.map(update => html`
        <li class="timeline__item">
          <div class="timeline__head">
            <span class="timeline__date">${formatDate(update.data)}${editable && !update.visibile && html` · <span class="timeline__private">non visibile all’investitore</span>`}</span>
            ${editable && html`<button type="button" class="icon-btn icon-btn--end" data-action="edit-update" data-id="${update.id}" aria-label="Modifica l’aggiornamento">${icon('edit', 18)}</button>`}
          </div>
          <h3 class="timeline__title">${update.titolo}</h3>
          ${update.testo && html`<p class="timeline__text">${update.testo}</p>`}
          ${update.photoIds?.length > 0 && html`<div class="timeline__photos">${update.photoIds.map(id => html`<button type="button" class="timeline__photo" data-action="open-photo" data-photo-frame>${photo(id)}</button>`)}</div>`}
        </li>`)}
    </ol>`;
}

registerActions({
  'open-photo': el => {
    const src = el.querySelector('img')?.src;
    if (src) openLightbox(src);
  },
});
