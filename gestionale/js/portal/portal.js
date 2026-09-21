// Area dell'investitore: accesso con codice via email, poi la lettura in tempo reale dei propri immobili.

import { html } from '../dom.js';
import { icon } from '../icons.js';
import { registerActions, toast } from '../actions.js';
import { BUCKET, getClient, isConfigured, photoPath } from '../supabase-client.js';
import { detailView, listView, loginView } from './views.js';
import '../timeline.js';
import { rememberOpenZones } from '../cost-zones.js';

const AUTH_KEY = 'innvesting-auth-investor';
const SIGNED_URL_TTL = 3600; // secondi
const POLL_MS = 45_000; // rete di sicurezza se il collegamento in tempo reale si interrompe

const topbar = document.getElementById('topbar');
const view = document.getElementById('view');

let supabase = null;
let rows = [];
let live = false;
let updatedAt = null;
let pollTimer = null;
const signedUrls = new Map(); // percorso → { url, expires }
const openZones = new Set(); // zone delle spese aperte, per non richiuderle a ogni aggiornamento in tempo reale
let loginState = { step: 'email', email: '', message: '' };

/* ── Barra superiore ────────────────────────────────────────────────────── */

function drawTopbar({ back = '', signedIn = false } = {}) {
  const time = updatedAt ? updatedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
  topbar.innerHTML = html`
    ${back && html`<a class="icon-btn" href="${back}" aria-label="Indietro">${icon('chevron-left', 24)}</a>`}
    <img class="topbar__logo" src="../images/logo-innvesting.png" alt="INNvesting">
    <span class="topbar__spacer"></span>
    ${signedIn && html`<span class="live ${live && 'is-live'}" title="${live ? 'Collegato in tempo reale' : 'Aggiornamento periodico'}"><span class="live__dot"></span>${live ? 'In diretta' : `Aggiornato ${time}`}</span>`}
    ${signedIn && html`<button type="button" class="icon-btn icon-btn--end" data-action="portal-sign-out" aria-label="Esci">${icon('lock', 20)}</button>`}`.value;
}

/* ── Foto: indirizzi firmati con scadenza ───────────────────────────────── */

const photoUrl = (propertyId, photoId) => {
  const row = rows.find(r => r.id === propertyId);
  return signedUrls.get(photoPath(row.owner_id, propertyId, photoId))?.url ?? '';
};

async function refreshPhotoUrls() {
  const now = Date.now();
  const wanted = rows.flatMap(row => [
    row.snapshot.property.photoId,
    ...row.snapshot.updates.flatMap(u => u.photoIds),
  ].filter(Boolean).map(id => photoPath(row.owner_id, row.id, id)));

  const missing = wanted.filter(path => !signedUrls.has(path) || signedUrls.get(path).expires - now < 120_000);
  if (!missing.length) return;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);
  if (error) return;
  data.forEach(item => {
    if (item.signedUrl) signedUrls.set(item.path, { url: item.signedUrl, expires: now + SIGNED_URL_TTL * 1000 });
  });
}

/* ── Dati e schermate ───────────────────────────────────────────────────── */

async function loadRows() {
  const { data, error } = await supabase.from('shared_properties').select('id, owner_id, snapshot, updated_at').order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  rows = data;
  await refreshPhotoUrls();
  updatedAt = new Date();
}

function route() {
  const [, , id, tab = 'aggiornamenti'] = location.hash.split('/'); // #/p/<id>/<tab>
  return { id, tab };
}

function render() {
  const { id, tab } = route();
  const row = rows.find(r => r.id === id) ?? (rows.length === 1 ? rows[0] : null);

  if (!rows.length) {
    drawTopbar({ signedIn: true });
    view.innerHTML = html`<div class="empty"><img class="empty__mark" src="../images/n-dot.svg" alt=""><p class="empty__title">Nessun immobile condiviso</p><p>Non ci sono ancora immobili collegati a questo indirizzo email. Se ti aspettavi di vederli, scrivici.</p></div>`.value;
    return;
  }

  if (row && (id || rows.length === 1)) {
    drawTopbar({ back: rows.length > 1 ? '#/' : '', signedIn: true });
    view.innerHTML = detailView(row, tab, photoUrl, openZones).value;
  } else {
    drawTopbar({ signedIn: true });
    view.innerHTML = listView(rows, photoUrl).value;
  }
}

function renderLogin() {
  drawTopbar();
  view.innerHTML = loginView(loginState).value;
  view.querySelector('input')?.focus();
}

/* ── Aggiornamento in tempo reale ───────────────────────────────────────── */

async function refresh() {
  try {
    const scrollY = window.scrollY;
    await loadRows();
    render();
    window.scrollTo(0, scrollY);
  } catch {
    /* rete assente: resta l'ultima versione e si riprova al prossimo giro */
  }
}

function startLive() {
  supabase.channel('shared-properties')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_properties' }, refresh)
    .subscribe(status => {
      live = status === 'SUBSCRIBED';
      drawTopbar({ back: rows.length > 1 && route().id ? '#/' : '', signedIn: true });
    });
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, POLL_MS);
}

async function enter() {
  try {
    await loadRows();
    render();
    startLive();
  } catch (error) {
    view.innerHTML = html`<div class="empty"><p class="empty__title">Non riusciamo a caricare i dati</p><p>${error.message}</p></div>`.value;
  }
}

/* ── Accesso ────────────────────────────────────────────────────────────── */

view.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type=submit]');
  button.disabled = true;
  try {
    if (form.dataset.form === 'email') {
      const email = form.elements.email.value.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw new Error(error.message);
      loginState = { step: 'code', email, message: '' };
      renderLogin();
    } else {
      const { error } = await supabase.auth.verifyOtp({ email: loginState.email, token: form.elements.code.value.trim(), type: 'email' });
      if (error) throw new Error('Codice non valido o scaduto.');
      await enter();
    }
  } catch (error) {
    loginState = { ...loginState, message: error.message };
    renderLogin();
  }
});

registerActions({
  'portal-restart': () => { loginState = { step: 'email', email: '', message: '' }; renderLogin(); },
  'portal-sign-out': async () => {
    clearInterval(pollTimer);
    await supabase.channel('shared-properties').unsubscribe();
    await supabase.auth.signOut();
    rows = [];
    signedUrls.clear();
    live = false;
    loginState = { step: 'email', email: '', message: '' };
    renderLogin();
    toast('Sei uscito');
  },
});

rememberOpenZones(view, openZones);
window.addEventListener('hashchange', () => { if (rows.length) render(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && rows.length) refresh(); });

/* ── Avvio ──────────────────────────────────────────────────────────────── */

(async function start() {
  if (!isConfigured()) {
    drawTopbar();
    view.innerHTML = html`<div class="empty"><p class="empty__title">Area non ancora attiva</p><p>Il servizio online non è ancora stato collegato.</p></div>`.value;
    return;
  }
  supabase = await getClient(AUTH_KEY);
  const { data } = await supabase.auth.getSession();
  if (data.session) await enter();
  else renderLogin();
})();
