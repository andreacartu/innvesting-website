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

## Limiti da conoscere

- Chiunque conosca l'indirizzo può provare ad accedere con la propria email, ma non vede niente se non è associata a un immobile condiviso.
- Le foto sono compresse (lato lungo 1400 px) prima di essere pubblicate.
- Se togli la spunta di condivisione o elimini l'immobile, la copia online e le sue foto vengono cancellate al primo aggiornamento.
- Lo spazio gratuito di Supabase (1 GB di file e 500 MB di database) è ampio per questo uso.
