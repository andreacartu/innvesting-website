// Ingresso: finché non si è entrati con l'account online l'app non mostra dati.
// I dati stanno sul database; la copia sul telefono si riempie solo dopo l'accesso.

import { html } from '../dom.js';
import { cloud } from '../cloud.js';
import { sync } from '../sync.js';
import { isEmpty } from '../store.js';
import { isConfigured } from '../supabase-client.js';

const screen = (title, text, actions = '') => ({
  topbar: html``,
  body: html`
    <section class="gate">
      <img class="gate__mark" src="../images/n-dot.svg" alt="">
      <h1 class="gate__title">${title}</h1>
      <p class="gate__text">${text}</p>
      ${actions}
    </section>`,
});

/* La schermata da mostrare al posto dell'app, oppure null quando si può entrare. */
export function gateView() {
  if (!isConfigured()) return null;

  switch (cloud.state) {
    case 'checking':
      return screen('Un momento', 'Controllo l’accesso…');
    case 'signed-out':
      return screen(
        'Accedi per entrare',
        'I dati sono salvati online e si aprono su ogni dispositivo. Ricevi un codice via email, senza password.',
        html`<button type="button" class="btn btn--primary btn--block" data-action="cloud-sign-in">Accedi</button>`,
      );
    case 'not-admin':
      return screen(
        'Account non abilitato',
        `${cloud.email} non ha accesso al gestionale. Entra con l’email giusta.`,
        html`<button type="button" class="btn btn--outline btn--block" data-action="cloud-sign-out">Esci dall’account</button>`,
      );
    default:
      // Copia sul telefono ancora vuota: non si può mostrare nulla finché i dati non arrivano dal database.
      if (isEmpty() && !sync.last) {
        return sync.state === 'error' || cloud.state === 'error'
          ? screen('Dati non raggiungibili', 'Serve la connessione per scaricare i dati online.', html`<button type="button" class="btn btn--primary btn--block" data-action="gate-retry">Riprova</button>`)
          : screen('Un momento', 'Scarico i dati online…');
      }
      return null;
  }
}
