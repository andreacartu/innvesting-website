// Schermata di blocco: logo e "Accedi", poi codice a 6 cifre oppure Face ID.
//
// È un blocco di riservatezza, non una cifratura: impedisce a chi prende in mano il telefono
// di vedere importi e fornitori, ma i dati in `localStorage` non sono criptati.
// Il codice è salvato solo come impronta (PBKDF2 con sale). Face ID usa WebAuthn (autenticatore
// del dispositivo) e richiede una connessione sicura (https).

import { html } from './dom.js';
import { icon } from './icons.js';
import { toast } from './actions.js';
import { resetAll } from './store.js';

const CONFIG_KEY = 'innvesting-gestionale-lock';
const PIN_LENGTH = 6;
const MAX_FAILS = 5;
const LOCKOUT_MS = 30_000;
const RELOCK_AFTER_MS = 60_000; // dopo quanto tempo in background l'app chiede di nuovo l'accesso
const PBKDF2_ITERATIONS = 150_000;
const PAD_MODES = ['verify', 'create', 'confirm', 'change-verify'];

const root = document.getElementById('lock');
const panel = document.getElementById('lock-panel');

let config = readConfig(); // { salt, hash, credentialId?, fails, lockedUntil } oppure null se il codice non è ancora stato creato
let locked = true;
let mode = 'idle'; // idle | verify | create | confirm | change-verify | bio-offer
let purpose = 'unlock'; // unlock | change
let entry = '';
let firstEntry = '';
let message = '';
let busy = false;
let biometricAvailable = false;
let countdown = null;
let hooks = { onLock: () => {}, onUnlock: () => {} };

/* ── Persistenza ────────────────────────────────────────────────────────── */

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY));
  } catch {
    return null;
  }
}

function saveConfig() {
  try {
    if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    toast('Impossibile salvare il codice: archivio bloccato');
  }
  window.dispatchEvent(new Event('lock:change'));
}

/* ── Crittografia ───────────────────────────────────────────────────────── */

const toB64 = buffer => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const fromB64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const randomBytes = length => crypto.getRandomValues(new Uint8Array(length));

async function derive(pin, saltB64) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS }, key, 256);
  return toB64(bits);
}

/* ── Face ID (WebAuthn, solo come verifica locale dell'identità) ────────── */

async function enrollBiometric() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'INNvesting', id: location.hostname },
      user: { id: randomBytes(16), name: 'gestionale', displayName: 'INNvesting Gestionale' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  });
  config = { ...config, credentialId: toB64(credential.rawId) };
  saveConfig();
}

async function verifyBiometric() {
  await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: fromB64(config.credentialId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
}

export const biometric = {
  supported: () => biometricAvailable,
  enabled: () => Boolean(config?.credentialId),
  enable: enrollBiometric,
  disable() {
    delete config.credentialId;
    saveConfig();
  },
};

/* ── Disegno ────────────────────────────────────────────────────────────── */

const inPad = () => PAD_MODES.includes(mode);

function titleForMode() {
  switch (mode) {
    case 'create': return purpose === 'change' ? 'Nuovo codice' : 'Crea il tuo codice';
    case 'confirm': return 'Ripeti il codice';
    case 'change-verify': return 'Codice attuale';
    default: return 'Inserisci il codice';
  }
}

function hintForMode() {
  if (mode === 'create' && purpose === 'unlock') return `${PIN_LENGTH} cifre per proteggere i tuoi dati`;
  return '';
}

function padHtml() {
  const canBiometric = mode === 'verify' && biometric.enabled();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => html`<button type="button" class="lock__key" data-lock="digit" data-digit="${d}">${d}</button>`);
  const aux = canBiometric
    ? html`<button type="button" class="lock__key lock__key--ghost" data-lock="bio" aria-label="Usa Face ID">${icon('face-id', 30)}</button>`
    : html`<span></span>`;
  const secondary = purpose === 'change'
    ? html`<button type="button" class="lock__link" data-lock="cancel">Annulla</button>`
    : mode === 'verify' && html`<button type="button" class="lock__link" data-lock="forgot">Codice dimenticato?</button>`;

  return html`
    <p class="lock__title">${titleForMode()}</p>
    <p class="lock__message" role="status">${message || hintForMode()}</p>
    <div class="lock__dots" aria-label="${entry.length} cifre su ${PIN_LENGTH}">${Array.from({ length: PIN_LENGTH }, () => html`<span class="lock__dot"></span>`)}</div>
    <div class="lock__pad">
      ${keys}${aux}
      <button type="button" class="lock__key" data-lock="digit" data-digit="0">0</button>
      <button type="button" class="lock__key lock__key--ghost" data-lock="delete" aria-label="Cancella">${icon('backspace', 28)}</button>
    </div>
    <div class="lock__links">${secondary}</div>`;
}

function renderPanel() {
  root.classList.toggle('lock--pad', inPad());
  if (mode === 'idle') {
    panel.innerHTML = html`<button type="button" class="lock__enter" data-lock="enter">${config ? 'Accedi' : 'Inizia'}</button>`.value;
  } else if (mode === 'bio-offer') {
    panel.innerHTML = html`
      <p class="lock__title">Sblocca con Face ID</p>
      <p class="lock__message">Per aprire il gestionale senza digitare il codice.</p>
      <button type="button" class="lock__enter" data-lock="enable-bio">${icon('face-id', 22)}Attiva Face ID</button>
      <div class="lock__links"><button type="button" class="lock__link" data-lock="skip-bio">Più tardi</button></div>`.value;
  } else {
    panel.innerHTML = padHtml().value;
  }
  updateDots();
}

function updateDots() {
  panel.querySelectorAll('.lock__dot').forEach((dot, i) => dot.classList.toggle('is-filled', i < entry.length));
}

function setMode(next, nextMessage = '') {
  mode = next;
  message = nextMessage;
  entry = '';
  renderPanel();
  if (next === 'verify' || next === 'change-verify') startCountdownIfLockedOut();
}

function shake() {
  const dots = panel.querySelector('.lock__dots');
  if (!dots) return;
  dots.classList.remove('is-error');
  void dots.offsetWidth; // riavvia l'animazione
  dots.classList.add('is-error');
  navigator.vibrate?.(120);
}

/* Blocco temporaneo dopo troppi tentativi sbagliati. */
const lockedOutFor = () => Math.max(0, Math.ceil(((config?.lockedUntil ?? 0) - Date.now()) / 1000));

function startCountdownIfLockedOut() {
  clearInterval(countdown);
  if (!lockedOutFor()) return;
  const tick = () => {
    const seconds = lockedOutFor();
    message = seconds ? `Troppi tentativi. Riprova tra ${seconds} s` : '';
    const el = panel.querySelector('.lock__message');
    if (el) el.textContent = message;
    if (!seconds) clearInterval(countdown);
  };
  tick();
  countdown = setInterval(tick, 1000);
}

/* ── Stati: blocca, sblocca, copri ──────────────────────────────────────── */

function showIntro() {
  root.hidden = false;
  root.classList.remove('is-opening', 'lock--covered', 'is-intro');
  void root.offsetWidth;
  root.classList.add('is-intro');
}

function hideOverlay() {
  root.hidden = true;
  root.classList.remove('is-opening', 'lock--covered', 'lock--pad');
}

function unlock() {
  locked = false;
  clearInterval(countdown);
  hooks.onUnlock();
  root.classList.add('is-opening');
  const finish = () => {
    hideOverlay();
    mode = 'idle';
    entry = '';
    message = '';
    renderPanel();
  };
  root.addEventListener('animationend', finish, { once: true });
  setTimeout(finish, 900);
}

export function lockNow() {
  if (!config) return;
  locked = true;
  hooks.onLock();
  mode = 'idle';
  purpose = 'unlock';
  entry = '';
  message = '';
  renderPanel();
  showIntro();
}

export const isLocked = () => locked;

export function startChangePin() {
  purpose = 'change';
  showIntro();
  setMode('change-verify');
}

function cancelChange() {
  purpose = 'unlock';
  hideOverlay();
  mode = 'idle';
  renderPanel();
}

/* ── Inserimento del codice ─────────────────────────────────────────────── */

async function submitPin(pin) {
  busy = true;
  try {
    if (mode === 'create') {
      firstEntry = pin;
      setMode('confirm');
      return;
    }

    if (mode === 'confirm') {
      if (pin !== firstEntry) {
        firstEntry = '';
        setMode('create', 'I due codici non coincidono. Riprova.');
        shake();
        return;
      }
      const salt = toB64(randomBytes(16));
      config = { ...config, salt, hash: await derive(pin, salt), fails: 0, lockedUntil: 0 };
      saveConfig();
      firstEntry = '';
      if (purpose === 'change') {
        purpose = 'unlock';
        hideOverlay();
        mode = 'idle';
        renderPanel();
        toast('Codice aggiornato');
      } else if (biometricAvailable && !biometric.enabled()) {
        setMode('bio-offer');
      } else {
        unlock();
      }
      return;
    }

    // verify / change-verify
    if (lockedOutFor()) return;
    if ((await derive(pin, config.salt)) === config.hash) {
      config.fails = 0;
      saveConfig();
      if (mode === 'change-verify') setMode('create');
      else unlock();
      return;
    }
    config.fails = (config.fails || 0) + 1;
    let wrongMessage = 'Codice errato';
    if (config.fails >= MAX_FAILS) {
      config.fails = 0;
      config.lockedUntil = Date.now() + LOCKOUT_MS;
      wrongMessage = '';
    }
    saveConfig();
    setMode(mode, wrongMessage);
    shake();
  } finally {
    busy = false;
  }
}

function pressDigit(digit) {
  if (busy || !inPad() || lockedOutFor() && (mode === 'verify' || mode === 'change-verify')) return;
  if (entry.length >= PIN_LENGTH) return;
  entry += digit;
  updateDots();
  if (entry.length === PIN_LENGTH) {
    const pin = entry;
    setTimeout(() => submitPin(pin), 120); // il tempo di vedere l'ultimo pallino riempirsi
  }
}

function pressDelete() {
  if (busy) return;
  entry = entry.slice(0, -1);
  updateDots();
}

async function unlockWithBiometric() {
  try {
    await verifyBiometric();
    unlock();
  } catch {
    setMode('verify'); // annullato o non riuscito: si passa al codice
  }
}

const handlers = {
  enter() {
    purpose = 'unlock';
    if (!config) setMode('create');
    else if (biometric.enabled()) unlockWithBiometric();
    else setMode('verify');
  },
  digit: el => pressDigit(el.dataset.digit),
  delete: pressDelete,
  bio: unlockWithBiometric,
  cancel: cancelChange,
  forgot() {
    const ok = confirm('Per proteggere i dati, senza il codice l’unico modo per rientrare è eliminare tutti i dati da questo dispositivo. Potrai poi ripristinarli da un backup. Vuoi procedere?');
    if (!ok) return;
    resetAll();
    config = null;
    saveConfig();
    setMode('idle');
    toast('Dati eliminati: crea un nuovo codice');
  },
  async 'enable-bio'() {
    try {
      await enrollBiometric();
      toast('Face ID attivato');
    } catch {
      toast('Non è stato possibile attivare Face ID');
    }
    unlock();
  },
  'skip-bio': () => unlock(),
};

root.addEventListener('click', event => {
  const el = event.target.closest('[data-lock]');
  if (el) handlers[el.dataset.lock]?.(el);
});

document.addEventListener('keydown', event => {
  if (root.hidden || !inPad()) return;
  if (/^\d$/.test(event.key)) pressDigit(event.key);
  else if (event.key === 'Backspace') pressDelete();
});

/* Quando l'app va in background la schermata viene coperta subito (anche nell'anteprima del selettore di app);
   al ritorno, dopo più di un minuto, chiede di nuovo l'accesso. */
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!config) return;
  if (document.visibilityState === 'hidden') {
    if (!locked && root.hidden) {
      hiddenAt = Date.now();
      root.classList.add('lock--covered');
      root.hidden = false;
    }
  } else if (hiddenAt) {
    const away = Date.now() - hiddenAt;
    hiddenAt = 0;
    if (away > RELOCK_AFTER_MS) lockNow();
    else hideOverlay();
  }
});

/* ── Avvio ──────────────────────────────────────────────────────────────── */

export function initLock(callbacks) {
  hooks = { ...hooks, ...callbacks };

  // Senza contesto sicuro (https o localhost) il browser non offre la crittografia necessaria: l'app si apre senza blocco.
  if (!globalThis.crypto?.subtle) {
    locked = false;
    hideOverlay();
    hooks.onUnlock();
    return;
  }

  window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()
    .then(available => { biometricAvailable = available; window.dispatchEvent(new Event('lock:change')); })
    .catch(() => {});

  showIntro();
  setMode('idle');
}
