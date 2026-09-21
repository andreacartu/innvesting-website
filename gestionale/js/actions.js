// Registro delle azioni: ogni elemento con data-action="nome" chiama la funzione registrata con quel nome.

const registry = new Map();

export const registerActions = handlers => {
  Object.entries(handlers).forEach(([name, handler]) => registry.set(name, handler));
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  const handler = target && registry.get(target.dataset.action);
  if (!handler) return;
  event.preventDefault();
  handler(target, event);
});

/* Messaggio breve in basso, sopra la barra di navigazione. */
let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}
