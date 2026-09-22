// Conferma a comparsa dentro l'app, al posto di window.confirm(): quella nativa non è affidabile nell'app
// installata (può non mostrarsi o risolversi da sola), rischioso per scelte che sostituiscono dei dati.
// Restituisce una Promise<boolean>: true se si sceglie il pulsante principale.

import { html } from './dom.js';

export function confirmDialog({ title, message, okLabel = 'Conferma', cancelLabel = 'Annulla', danger = false }) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'sheet';
    root.innerHTML = html`
      <div class="sheet__backdrop"></div>
      <div class="sheet__panel confirm-panel" role="alertdialog" aria-modal="true" aria-label="${title}">
        <div class="sheet__body">
          <p class="sheet__title">${title}</p>
          <p class="field__hint confirm-panel__message">${message}</p>
        </div>
        <footer class="sheet__footer confirm-panel__footer">
          <button type="button" class="btn btn--outline" data-cancel>${cancelLabel}</button>
          <button type="button" class="btn ${danger ? 'btn--outline btn--danger' : 'btn--primary'}" data-ok>${okLabel}</button>
        </footer>
      </div>`.value;
    document.body.append(root);
    document.documentElement.classList.add('is-locked');

    const close = result => {
      root.remove();
      if (!document.querySelector('.sheet')) document.documentElement.classList.remove('is-locked');
      resolve(result);
    };
    root.querySelector('[data-ok]').addEventListener('click', () => close(true));
    root.querySelector('[data-cancel]').addEventListener('click', () => close(false));
  });
}
