# Condivisione con gli investitori: come attivarla

Il gestionale funziona anche senza questa parte. Serve solo per far vedere a ogni investitore, in tempo reale, l'avanzamento dei lavori, le spese e i pagamenti del **suo** immobile. Ci vogliono circa 15 minuti e un account gratuito su Supabase.

## Come funziona

- I tuoi dati restano nel gestionale, sul telefono.
- Per ogni immobile con "Condividi i lavori in tempo reale" attivo, il gestionale pubblica online una **copia ridotta**: dati economici, spese e pagamenti, nomi delle imprese, aggiornamenti e foto. Non escono mai le note private, i link ai documenti, i recapiti dei fornitori e gli altri immobili.
- L'investitore apre `investitore.html`, inserisce la sua email, riceve un codice e vede solo l'immobile associato alla sua email, in sola lettura.
- A ogni tua modifica la copia si aggiorna da sola, e lui la vede cambiare senza ricaricare la pagina.

## 1. Crea il progetto

1. Vai su [supabase.com](https://supabase.com), crea un account e un nuovo progetto (scegli una regione europea, per esempio Francoforte).
2. In **Project Settings > API** copia due valori: **Project URL** e la chiave **anon public**.
3. Incollali in [`js/cloud-config.js`](../js/cloud-config.js). La chiave anon è pubblica per progetto: la sicurezza è nelle regole del database, non nella chiave.

## 2. Crea le tabelle e le regole di accesso

1. In Supabase apri **SQL Editor > New query**.
2. Apri [`setup.sql`](setup.sql), sostituisci `SOSTITUISCI-CON-LA-TUA-EMAIL@esempio.it` con la tua email, incolla tutto e premi **Run**.

## 3. Fai arrivare il codice nell'email

Il gestionale usa un codice numerico (non il link), perché sull'iPhone il link si aprirebbe in Safari e non nell'app aggiunta alla Home.

1. **Authentication > Email Templates > Magic Link**: nel testo aggiungi una riga con `{{ .Token }}`, per esempio `Il tuo codice di accesso: {{ .Token }}`.
2. **Authentication > Providers > Email**: lascia attiva l'opzione "Confirm email" come preferisci; il codice a 6 cifre è quello predefinito.

## 4. Imposta un servizio di invio email (importante)

L'invio di Supabase incluso è limitato a pochissime email all'ora: va bene per provare, non per gli investitori. Per l'uso reale collega un servizio gratuito (per esempio Resend o Brevo) in **Authentication > SMTP Settings**. Senza questo passaggio i codici possono arrivare in ritardo o non arrivare.

## 5. Pubblica il gestionale

Dopo il commit su `main`, il gestionale è su `.../gestionale/` e l'area investitore su `.../gestionale/investitore.html`. In **Authentication > URL Configuration** imposta come Site URL l'indirizzo del sito.

## 6. Prova

1. Nel gestionale: **Altro > Condivisione online > Accedi** con la tua email, poi digita il codice ricevuto.
2. Apri un immobile, **Modifica**, inserisci nome ed email dell'investitore e attiva "Condividi i lavori in tempo reale".
3. Invia all'investitore il link `investitore.html`: entra con la sua email e vede l'immobile.


## Salvare i dati online e usarli da più dispositivi

Oltre alla condivisione con gli investitori, il gestionale può tenere **tutti i tuoi dati** (immobili, fornitori, costi, pagamenti, aggiornamenti di cantiere e foto) sul server. Così non importi più nulla: li ritrovi aggiornati su ogni dispositivo in cui accedi con la tua email.

1. In Supabase, **SQL Editor > New query**: incolla il contenuto di [`dati-online.sql`](dati-online.sql) e premi **Run**. Crea la tabella `records` (accessibile solo a te) e attiva gli aggiornamenti in tempo reale.
2. Nel gestionale: **Altro > Archivio online > Accedi** con la tua email. Al primo accesso i dati di questo dispositivo vengono caricati online. Su un altro dispositivo, dopo l'accesso, i dati arrivano da soli.
3. Da quel momento ogni modifica parte da sola e quelle fatte altrove compaiono senza fare nulla. Senza rete, le modifiche restano sul dispositivo e partono appena torna la connessione.

**Come funziona**
- Una copia dei dati resta sul telefono: l'app si apre subito e funziona anche offline.
- Se modifichi la stessa voce da due dispositivi nello stesso momento, vince l'ultima modifica inviata.
- Le foto stanno in una cartella privata dell'archivio, separata da quella dell'investitore: le foto degli aggiornamenti non visibili all'investitore non escono mai.
- Se accedi con un account che ha già dati online su un dispositivo che ne ha altri, l'app chiede quali tenere.
- "Elimina i dati da questo dispositivo" non cancella quelli online: tornano alla prossima sincronizzazione. Per cancellare davvero, elimina l'immobile o la voce dall'app.
- "Ripristina da un backup" sostituisce i dati anche online.

## Limiti da conoscere

- Chiunque conosca l'indirizzo può provare ad accedere con la propria email, ma non vede niente se non è associata a un immobile condiviso.
- Le foto sono compresse (lato lungo 1400 px) prima di essere pubblicate.
- Se togli la spunta di condivisione o elimini l'immobile, la copia online e le sue foto vengono cancellate al primo aggiornamento.
- Lo spazio gratuito di Supabase (1 GB di file e 500 MB di database) è ampio per questo uso.

## Rafforzare la sicurezza

1. **Esegui [`rafforza-sicurezza.sql`](rafforza-sicurezza.sql)** nell'SQL Editor: limita chi può chiamare la funzione degli amministratori e accetta nell'archivio solo foto JPEG fino a 5 MB.
2. **Accorcia la validità del codice**: in Supabase, **Authentication > Sign In / Providers > Email**, imposta la scadenza del codice (OTP expiry) a **600** secondi (10 minuti) invece di un'ora.
3. **Attiva il CAPTCHA**: **Authentication > Attack Protection**, abilita Cloudflare Turnstile o hCaptcha. Senza, chiunque può far partire email di codice verso indirizzi altrui dal tuo Gmail. (Dopo averlo attivato, il gestionale e l'area investitore devono inviare anche il token del CAPTCHA: chiedilo prima di attivarlo, perché richiede una piccola modifica.)
4. **Attiva la verifica in due passaggi** su Google, GitHub e Supabase. Chi entra nel tuo GitHub può cambiare il codice dell'app; chi entra in Supabase può leggere i dati condivisi.
5. **Controlla ogni tanto** **Authentication > Users**: devono comparire solo te e i tuoi investitori.
6. **Non inserire mai nel repository** la chiave *secret* di Supabase, la password per le app di Google o i backup del gestionale. La chiave *publishable* in `js/cloud-config.js` è invece pensata per essere pubblica.
