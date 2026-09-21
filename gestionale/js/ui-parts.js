// Elementi di interfaccia "puri", senza dipendenze dall'archivio: li usano sia il gestionale sia l'area dell'investitore.

import { html } from './dom.js';
import { icon } from './icons.js';

export const badge = (text, tone = '', iconName = '') =>
  html`<span class="badge ${tone && `badge--${tone}`}">${iconName && icon(iconName, 13)}${text}</span>`;

export function bar(value, max, { over = false, label = 'Avanzamento', onDark = false } = {}) {
  const safeMax = max > 0 ? max : 1;
  const classes = ['bar', over && 'bar--over', onDark && 'bar--on-dark'].filter(Boolean).join(' ');
  return html`<progress class="${classes}" max="${safeMax}" value="${Math.max(0, Math.min(value, safeMax))}" aria-label="${label}"></progress>`;
}

/* Foto a schermo intero: tocca ovunque (o premi Esc) per chiudere. */
export function openLightbox(src) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = html`<img class="lightbox__image" alt="Foto a schermo intero"><button type="button" class="lightbox__close" aria-label="Chiudi">${icon('x', 26)}</button>`.value;
  overlay.querySelector('img').src = src;

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = event => { if (event.key === 'Escape') close(); };
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
}
