import { html } from '../dom.js';
import { icon } from '../icons.js';
import { emptyState } from '../components.js';
import { registerActions, toast } from '../actions.js';
import { openUpdateForm } from '../editors.js';
import { state } from '../store.js';
import { updatesTimeline } from '../timeline.js';

/* Le foto arrivano dal telefono: l'<img> viene riempito dopo il disegno (vedi hydratePhotos in app.js). */
const localPhoto = id => html`<img data-photo="${id}" alt="Foto del cantiere">`;

export function updatesTab(property) {
  const updates = state().updates.filter(u => u.propertyId === property.id);

  return html`
    <div class="section__head">
      <h2 class="section__title">Avanzamento lavori</h2>
      <button type="button" class="btn btn--primary btn--sm" data-action="new-update" data-property="${property.id}">${icon('plus', 18)}Nuovo</button>
    </div>
    ${property.avanzamento > 0 && html`<p class="footnote">Avanzamento indicato: ${property.avanzamento}%. Si modifica dai dati dell’immobile.</p>`}
    ${updates.length
      ? updatesTimeline(updates, { photo: localPhoto, editable: true })
      : emptyState('Ancora nessun aggiornamento', 'Scrivi due righe e aggiungi qualche foto ad ogni passo del cantiere: l’investitore le vede subito, se l’immobile è condiviso.')}`;
}

registerActions({
  'new-update': async el => {
    const id = await openUpdateForm({ propertyId: el.dataset.property });
    if (typeof id === 'string') toast('Aggiornamento aggiunto');
  },
  'edit-update': async el => {
    const result = await openUpdateForm({ id: el.dataset.id });
    if (result?.deleted) toast('Aggiornamento eliminato');
  },
});
