import { icon } from './icons.js';
import { registerActions, toast } from './actions.js';
import { requestPersistence, subscribe } from './store.js';
import { ui } from './ui-state.js';
import { dashboardView } from './views/dashboard.js';
import { propertiesView, propertyView } from './views/properties.js';
import { costView } from './views/costs.js';
import { paymentsView } from './views/payments.js';
import { suppliersView, supplierView } from './views/suppliers.js';
import { settingsView } from './views/settings.js';
import { initLock, isLocked } from './lock.js';
import { initCloud } from './cloud.js';
import { hydratePhotos } from './photos.js';
import './timeline.js';

const topbar = document.getElementById('topbar');
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const app = document.querySelector('.app');

const TABS = [
  { key: 'home', label: 'Home', href: '#/', icon: 'home' },
  { key: 'immobili', label: 'Immobili', href: '#/immobili', icon: 'building' },
  { key: 'pagamenti', label: 'Pagamenti', href: '#/pagamenti', icon: 'wallet' },
  { key: 'fornitori', label: 'Fornitori', href: '#/fornitori', icon: 'users' },
  { key: 'altro', label: 'Altro', href: '#/altro', icon: 'more' },
];

// Ogni rotta associa un indirizzo (dopo il "#") a una schermata e alla voce della barra da evidenziare.
const ROUTES = [
  { pattern: /^\/$/, tab: 'home', view: dashboardView },
  { pattern: /^\/immobili$/, tab: 'immobili', view: propertiesView },
  { pattern: /^\/immobili\/([^/]+)(?:\/(costi|aggiornamenti|fornitori|info))?$/, tab: 'immobili', view: propertyView },
  { pattern: /^\/costi\/([^/]+)$/, tab: 'immobili', view: costView },
  { pattern: /^\/pagamenti$/, tab: 'pagamenti', view: paymentsView },
  { pattern: /^\/fornitori$/, tab: 'fornitori', view: suppliersView },
  { pattern: /^\/fornitori\/([^/]+)$/, tab: 'fornitori', view: supplierView },
  { pattern: /^\/altro$/, tab: 'altro', view: settingsView },
];

function resolveRoute() {
  const path = location.hash.slice(1) || '/';
  for (const route of ROUTES) {
    const match = path.match(route.pattern);
    if (match) return { route, path, params: match.slice(1).map(p => (p === undefined ? p : decodeURIComponent(p))) };
  }
  return null;
}

function renderTabbar(active) {
  tabbar.innerHTML = TABS.map(tab => `
    <a class="tabbar__item" href="${tab.href}" ${tab.key === active ? 'aria-current="page"' : ''}>${icon(tab.icon, 24).value}<span>${tab.label}</span></a>`).join('');
}

let lastPath = null;

function render() {
  if (isLocked()) return; // nessun dato sullo schermo finché non si sblocca
  const resolved = resolveRoute();
  const screen = resolved?.route.view(...resolved.params);
  if (!screen) {
    // Indirizzo sconosciuto o elemento che non esiste più (per esempio appena eliminato): torno alla panoramica.
    if (location.hash !== '#/') location.hash = '#/';
    return;
  }

  const scrollY = window.scrollY;
  topbar.innerHTML = screen.topbar.value;
  view.innerHTML = screen.body.value;
  renderTabbar(resolved.route.tab);
  screen.mount?.(view);
  hydratePhotos(view);

  window.scrollTo(0, resolved.path === lastPath ? scrollY : 0);
  lastPath = resolved.path;
}

registerActions({
  'set-filter': el => {
    ui[el.dataset.key] = el.dataset.value;
    render();
  },
});

/* Da bloccata l'app svuota lo schermo (niente importi nel documento); allo sblocco ridisegna e fa entrare i contenuti. */
function clearScreen() {
  topbar.innerHTML = '';
  view.innerHTML = '';
  tabbar.innerHTML = '';
  lastPath = null;
}

function onUnlock() {
  render();
  app.classList.add('is-entering');
  setTimeout(() => app.classList.remove('is-entering'), 1600);
}

window.addEventListener('hashchange', render);
window.addEventListener('store:error', () => toast('Impossibile salvare: spazio esaurito o archivio bloccato'));
subscribe(render);
window.addEventListener('lock:change', render);
window.addEventListener('cloud:change', render);
initLock({ onLock: clearScreen, onUnlock });
requestPersistence();
initCloud();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
