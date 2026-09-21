import { html } from '../dom.js';
import { icon } from '../icons.js';
import { formatDate, todayISO, toISO } from '../format.js';
import { costPaid, costRemaining, costTotal, propertyCode } from '../calc.js';
import { CATEGORIE_COSTO, labelOf } from '../labels.js';
import { registerActions, toast } from '../actions.js';
import { rootBar } from '../components.js';
import { biometric, lockNow, startChangePin } from '../lock.js';
import { exportBackupJson, isEmpty, loadDemo, markBackup, mergeImport, replaceAll, resetAll, state } from '../store.js';
import { cloud, sendCode, signOut, syncNow, verifyCode } from '../cloud.js';
import { forgetSyncState, sync, syncData } from '../sync.js';
import { isConfigured } from '../supabase-client.js';
import { openForm } from '../sheet.js';

const STALE_AFTER_DAYS = 14;

/* Promemoria backup: vale solo se ci sono dati e l'ultimo backup è vecchio (o non c'è mai stato). */
export function backupIsStale() {
  if (isEmpty()) return false;
  const last = state().meta.lastBackup;
  if (!last) return true;
  return (Date.now() - new Date(last).getTime()) / 86400000 > STALE_AFTER_DAYS;
}

/* Consegna un file: sul telefono apre il foglio di condivisione ("Salva su File", AirDrop, Mail), altrove lo scarica. */
async function deliverFile(name, type, content) {
  const file = new File([content], name, { type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/* Un testo che inizia con = + - @ verrebbe eseguito come formula da Excel: lo si neutralizza con un apice (i numeri restano tali). */
const csvCell = value => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(,\d+)?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
const csvNumber = value => String(value).replace('.', ',');

function costsCsv() {
  const { costs, properties, suppliers } = state();
  const header = ['Immobile', 'Zona', 'Fornitore', 'Voce', 'Categoria', 'Importo', 'IVA %', 'Totale', 'Pagato', 'Residuo'];
  const lines = costs.map(cost => {
    const property = properties.find(p => p.id === cost.propertyId);
    const supplier = suppliers.find(s => s.id === cost.supplierId);
    return [
      property ? `${propertyCode(property)} ${property.nome}` : '',
      cost.zona ?? '',
      supplier?.nome ?? '',
      cost.descrizione,
      labelOf(CATEGORIE_COSTO, cost.categoria),
      csvNumber(cost.importo),
      csvNumber(cost.iva || 0),
      csvNumber(costTotal(cost)),
      csvNumber(costPaid(cost)),
      csvNumber(costRemaining(cost)),
    ].map(csvCell).join(';');
  });
  // BOM iniziale: Excel riconosce così gli accenti; punto e virgola come separatore, come si aspetta Excel in italiano.
  return `﻿${[header.map(csvCell).join(';'), ...lines].join('\r\n')}`;
}

const timeOf = iso => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

/* Riga di stato dell'archivio online: quando è stato allineato l'ultima volta e se ci sono modifiche in attesa. */
function syncLine() {
  const pending = sync.pending ? ` ${sync.pending} ${sync.pending === 1 ? 'modifica in attesa' : 'modifiche in attesa'}.` : '';
  switch (sync.state) {
    case 'syncing': return `Sincronizzazione in corso…${pending}`;
    case 'error': return `Non allineato: ${sync.error} Le modifiche restano su questo dispositivo e partono appena possibile.${pending}`;
    case 'idle': return `Dati online allineati${sync.last ? ` alle ${timeOf(sync.last)}` : ''}.${pending}`;
    default: return '';
  }
}

function cloudSection() {
  switch (cloud.state) {
    case 'off':
      return html`<div class="notes">L’archivio online non è ancora collegato. Segui le istruzioni in gestionale/supabase/LEGGIMI.md: bastano pochi minuti e un account gratuito su Supabase.</div>`;
    case 'checking':
      return html`<p class="muted">Controllo del collegamento…</p>`;
    case 'signed-out':
      return html`
        <p class="muted">Accedi con la tua email per salvare i dati online: li ritrovi aggiornati su ogni dispositivo, senza importare nulla, e puoi far seguire i lavori ai tuoi investitori. Ricevi un codice via email, senza password.</p>
        <div class="stack section"><button type="button" class="btn btn--primary btn--block" data-action="cloud-sign-in">Accedi</button></div>`;
    default: {
      const notAdmin = cloud.state === 'not-admin';
      return html`
        <p class="muted">Collegato come <strong>${cloud.email}</strong>. ${notAdmin ? 'Questo account non è abilitato: vedi le istruzioni in supabase/LEGGIMI.md.' : syncLine()}</p>
        ${!notAdmin && html`<p class="footnote">I dati sono salvati online e si aggiornano da soli su tutti i dispositivi in cui accedi con questa email. Una copia resta sul telefono, così l’app si apre subito e funziona anche senza rete.</p>`}
        ${!notAdmin && html`<p class="footnote">Per far vedere un immobile a un investitore aprilo, tocca Modifica e attiva “Condividi i lavori in tempo reale”, indicando la sua email.</p>`}
        <div class="stack section">
          ${!notAdmin && html`<button type="button" class="btn btn--outline btn--block" data-action="cloud-sync">Aggiorna ora</button>`}
          <button type="button" class="btn btn--outline btn--block" data-action="cloud-sign-out">Esci dall’account</button>
        </div>`;
    }
  }
}

export function settingsView() {
  const last = state().meta.lastBackup;
  const empty = isEmpty();

  const body = html`
    <p class="eyebrow">Impostazioni</p>
    <h1 class="page-title">Dati e backup</h1>
    <p class="lead">${cloud.state === 'idle' || cloud.state === 'syncing' || cloud.state === 'error' ? 'I dati sono salvati online e sempre aggiornati su tutti i tuoi dispositivi. Il backup è una copia di sicurezza in più.' : 'I dati restano su questo dispositivo finché non accedi all’archivio online. Il backup è la tua copia di sicurezza.'}</p>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Archivio online</h2></div>
      ${cloudSection()}
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Sicurezza</h2></div>
      <div class="stack">
        <button type="button" class="btn btn--dark btn--block" data-action="lock-now">${icon('lock', 20)}Blocca ora</button>
        <button type="button" class="btn btn--outline btn--block" data-action="change-pin">Cambia il codice</button>
        ${biometric.supported() && html`<button type="button" class="btn btn--outline btn--block" data-action="toggle-biometric">${icon('face-id', 20)}${biometric.enabled() ? 'Disattiva Face ID' : 'Attiva Face ID'}</button>`}
      </div>
      <p class="footnote">L’app chiede il codice all’apertura e dopo un minuto in background. È un blocco di riservatezza: per una copia al sicuro dei dati usa il backup.</p>
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Backup</h2></div>
      <p class="muted">${last ? `Ultimo backup: ${formatDate(toISO(new Date(last)))}.` : 'Non hai ancora fatto nessun backup.'}</p>
      <div class="stack section">
        <button type="button" class="btn btn--primary btn--block" data-action="export-backup" ${empty && html`disabled`}>${icon('download', 20)}Salva un backup</button>
        <button type="button" class="btn btn--outline btn--block" data-action="import-backup">${icon('upload', 20)}Ripristina da un backup</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
      <p class="footnote">Sul telefono si apre il foglio di condivisione: scegli “Salva su File” oppure inviatelo per email. Per usare gli stessi dati su un altro dispositivo, salva il backup lì e ripristinalo.</p>
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Importa</h2></div>
      <button type="button" class="btn btn--outline btn--block" data-action="import-merge">${icon('upload', 20)}Aggiungi immobile e costi da un file</button>
      <input type="file" id="merge-file" accept="application/json,.json" hidden>
      <p class="footnote">Aggiunge al gestionale gli elementi del file, senza toccare quello che c’è già. Un file importato due volte non crea doppioni.</p>
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Esporta</h2></div>
      <button type="button" class="btn btn--outline btn--block" data-action="export-csv" ${empty && html`disabled`}>${icon('download', 20)}Costi in formato CSV (Excel)</button>
      <p class="footnote">Un elenco di tutti i costi con importi, IVA, pagato e residuo, utile per il commercialista.</p>
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Installa sul telefono</h2></div>
      <div class="notes">Su iPhone apri questa pagina con Safari, tocca Condividi e poi “Aggiungi alla schermata Home”. Si apre a schermo intero, come un’app, e funziona anche senza connessione.</div>
    </section>

    <section class="section">
      <div class="section__head"><h2 class="section__title">Archivio</h2></div>
      <div class="stack">
        ${empty && !isConfigured() && html`<button type="button" class="btn btn--outline btn--block" data-action="load-demo">Carica dati di esempio</button>`}
        <button type="button" class="btn btn--outline btn--block btn--danger" data-action="reset-all" ${empty && html`disabled`}>Elimina i dati da questo dispositivo</button>
      </div>
    </section>`;

  return {
    topbar: rootBar(),
    body,
    mount: root => {
      root.querySelector('#import-file').addEventListener('change', async event => {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;
        try {
          const imported = JSON.parse(await file.text());
          const counts = `${imported.properties?.length ?? 0} immobili, ${imported.suppliers?.length ?? 0} fornitori, ${imported.costs?.length ?? 0} costi`;
          const online = cloud.state === 'idle' || cloud.state === 'syncing' || cloud.state === 'error';
          if (!confirm(`Ripristinare il backup (${counts})? I dati attuali verranno sostituiti${online ? ', anche quelli salvati online' : ' su questo dispositivo'}.`)) return;
          await replaceAll(imported);
          toast('Backup ripristinato');
        } catch (error) {
          toast(error instanceof SyntaxError ? 'Il file non è un backup valido' : error.message);
        }
      });

      root.querySelector('#merge-file').addEventListener('change', async event => {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;
        try {
          const imported = JSON.parse(await file.text());
          const counts = `${imported.properties?.length ?? 0} immobili, ${imported.suppliers?.length ?? 0} fornitori, ${imported.costs?.length ?? 0} costi`;
          if (!confirm(`Aggiungere al gestionale il contenuto del file (${counts})? Quello che c’è già non viene modificato.`)) return;
          const added = mergeImport(imported);
          toast(added.properties || added.costs ? `Aggiunti ${added.properties} immobile e ${added.costs} costi` : 'Niente di nuovo: il file era già stato importato');
        } catch (error) {
          toast(error instanceof SyntaxError ? 'Il file non è valido' : error.message);
        }
      });
    },
  };
}

registerActions({
  'export-backup': async () => {
    if (await deliverFile(`innvesting-backup-${todayISO()}.json`, 'application/json', await exportBackupJson())) {
      markBackup();
      toast('Backup salvato');
    }
  },
  'import-backup': () => document.getElementById('import-file').click(),
  'import-merge': () => document.getElementById('merge-file').click(),
  'export-csv': async () => {
    if (await deliverFile(`innvesting-costi-${todayISO()}.csv`, 'text/csv', costsCsv())) toast('Elenco dei costi esportato');
  },
  'load-demo': () => {
    if (!isEmpty() && !confirm('Caricare i dati di esempio sostituisce quelli attuali. Continuare?')) return;
    loadDemo();
    location.hash = '#/';
    toast('Dati di esempio caricati');
  },
  'reset-all': async () => {
    const online = cloud.state === 'idle' || cloud.state === 'syncing' || cloud.state === 'error';
    const question = online
      ? 'Eliminare i dati da questo dispositivo? Quelli salvati online restano al sicuro e torneranno alla prossima sincronizzazione.'
      : 'Eliminare tutti i dati (immobili, fornitori, costi e pagamenti) da questo dispositivo? Se non hai un backup, non si potranno recuperare.';
    if (!confirm(question)) return;
    await resetAll();
    forgetSyncState(); // ripartendo da zero, i dati online tornano per intero
    if (online) syncData();
    toast('Dati eliminati da questo dispositivo');
  },
});

registerActions({
  'lock-now': () => lockNow(),
  'change-pin': () => startChangePin(),
  'toggle-biometric': async () => {
    try {
      if (biometric.enabled()) {
        biometric.disable();
        toast('Face ID disattivato');
      } else {
        await biometric.enable();
        toast('Face ID attivato');
      }
    } catch {
      toast('Non è stato possibile attivare Face ID');
    }
  },
});

registerActions({
  'cloud-sign-in': async () => {
    let email = '';
    const asked = await openForm({
      title: 'Accedi',
      fields: [{ name: 'email', label: 'La tua email', type: 'email', required: true, placeholder: 'nome@email.it' }],
      submitLabel: 'Invia il codice',
      onSubmit: async values => { await sendCode(values.email); email = values.email; return true; },
    });
    if (!asked) return;
    const done = await openForm({
      title: 'Inserisci il codice',
      fields: [
        { type: 'note', text: `Abbiamo scritto a ${email}: apri l’email e digita qui il codice.` },
        { name: 'codice', label: 'Codice', required: true, placeholder: '123456' },
      ],
      submitLabel: 'Accedi',
      onSubmit: async values => { await verifyCode(email, values.codice); return true; },
    });
    if (done) toast('Accesso eseguito');
  },
  'cloud-sync': () => { syncData(); syncNow(); },
  'cloud-sign-out': async () => {
    await signOut();
    toast('Uscito dalla condivisione');
  },
});

