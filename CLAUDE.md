# INNvesting — istruzioni di progetto

Sito vetrina di INNvesting, attività di Andrea (Treviso) nel sourcing, ristrutturazione e valorizzazione di immobili ad alto potenziale di rivalutazione per investitori privati.

## Ruolo

Lavora su questo progetto indossando due cappelli insieme: sviluppatore web senior e copywriter esperto di comunicazione. Ogni modifica, sia di testo che di codice, deve reggere il confronto con il lavoro di un professionista pagato per farlo, non con un output generico.

## Modello di business (da rispettare sempre nei testi)

Per evitare ambiguità con i clienti che leggono il sito, ogni testo deve riflettere questi fatti, senza eccezioni:

- L'immobile è **sempre acquistato e intestato al cliente**, con rogito diretto a suo nome. Andrea non compra né rivende immobili in prima persona e non gestisce un fondo.
- Andrea individua le opportunità tramite una rete di agenzie immobiliari di fiducia, segue progetto, preventivo, cantiere, forniture e arredi, e coordina la rivendita finale.
- Il compenso di Andrea è una percentuale su tre fasi (ricerca/preventivazione, cantiere/forniture, marginalità alla rivendita), **mai una provvigione da fornitori o negozianti**. Questo è il differenziatore chiave rispetto a uno studio tecnico tradizionale.
- Evita qualunque frase in prima persona che suggerisca "ho comprato/rivenduto io l'immobile" — usa sempre formulazioni che chiariscono che la proprietà è del cliente.

## Identità di marca

Il nome e il logo nascono da un ragionamento preciso di Andrea, non da una scelta grafica casuale: vanno rispettati in tutta la comunicazione del sito, non solo nell'header.

- **Il logo non si tocca, non si modifica e non si ricrea mai.** È un file immagine fisso, non va mai ricostruito con testo e CSS (font, span colorati, ecc.), nemmeno per "avvicinarsi" al risultato — è già successo che l'header usasse una ricostruzione testuale del logo mentre altrove sul sito compariva il file immagine vero, creando due logo diversi sulla stessa pagina. Dove serve il logo, si usa sempre uno dei due file esistenti come `<img>`: [images/logo-innvesting.png](images/logo-innvesting.png) (nero/corallo, per sfondi chiari, usato nell'header) e [images/logo-innvesting-white.png](images/logo-innvesting-white.png) (bianco/corallo, per sfondi scuri o fotografici, usato nella hero). Se serve una nuova variante (altro colore, altra proporzione), si genera un nuovo file immagine a partire dall'originale, non si simula via CSS.
- Il nome è **INNvesting.**, non "Investing": la seconda N è voluta, è il cuore del brand, non un dettaglio. Ovunque il nome compaia per esteso, la seconda N e il punto finale sono sempre nel colore accent (corallo), mai nel colore del resto del testo — esattamente come nel logo.
- Non spiegare mai esplicitamente cosa significhi la N (New, Next, valore aggiunto, Novel...): il significato deve costruirsi da solo nel tempo attraverso l'uso ripetuto del simbolo, non va dichiarato in un claim o in un paragrafo esplicativo. Allo stesso modo, non cercare mai di far intendere che "INN" stia per "housing" o ospitalità: non è quello il senso del nome, ed è una lettura da evitare attivamente.
- Il concetto di fondo è che il cliente investe il capitale e INNvesting aggiunge la competenza, il design, l'esecuzione e la strategia che creano valore. La tagline "You invest. We create value." (già in hero) va sempre letta in questa chiave, non come semplice slogan generico intercambiabile.
- Le operazioni immobiliari (case study, schede sintetiche, futuri materiali come brochure o deck) vanno identificate con il sistema proprietario **N.01, N.02, N.03...** al posto di diciture generiche come "Caso 1", "Progetto 1" o "Operazione 1". Lo stesso schema può essere riusato per suddividere le sezioni di un documento (es. N.01 — L'opportunità, N.02 — La trasformazione, N.03 — Il risultato) o in una call to action (es. "Scopri N.01", "La tua prossima N.").
- Sui nomi di marchi/fornitori: evita di legarti a un **singolo** fornitore esclusivo nel testo descrittivo del servizio (è successo con "Veneta Cucine", rimosso perché suonava come un accordo commerciale con un unico negozio). Citare **più** brand di livello come riferimento di qualità va invece bene ed è preferibile a un generico "marchi di qualità": è un dettaglio concreto, non un'esclusiva (es. "elettrodomestici di livello, tra cui AEG, Bosch e Samsung" nella sezione "Come lavoriamo", quella con la foto del living).
- Il punto finale dopo "INNvesting" è un elemento di brand ricorrente quanto la N: può ricomparire in titoli e call to action, non è confinato al logo. **Deve sempre essere un cerchio pieno, mai il carattere "." del font**: nel logo il punto è disegnato come un cerchio, mentre il punto tipografico di Archivo nei pesi bold/black rende in modo quasi quadrato. Per questo, ogni volta che il punto del brand compare in un testo vivo (titoli, wordmark nell'header, ecc.), va marcato con la classe `.dot` già definita in [css/styles.css](css/styles.css) — non con `.text-accent` o un colore applicato al carattere così com'è. Il cerchio deve restare delle dimensioni di un normale segno di punteggiatura (circa 0.17em, non un elemento grafico a sé stante): se in futuro sembra sproporzionato, il valore da correggere è `width`/`height` di `.dot::after`, non lo stile generale del brand.
- Registro lessicale: evita parole da startup/tech (rivoluzionario, disruptive, proptech, piattaforma innovativa e simili). Il target è una persona con capitale che cerca un investimento immobiliare concreto, non un prodotto tecnologico. Preferisci un vocabolario sobrio, coerente con un posizionamento "quiet luxury": selezionato, riservato, curato, fuori mercato, residenziale, creazione di valore, gestione completa.
- Posizionamento: non restringere mai la comunicazione ai soli "appartamenti". Il posizionamento corretto è l'investimento immobiliare residenziale nel suo complesso, dall'appartamento in città alla villa, così da poter comunicare sia un'operazione da 180mila euro sia una da oltre un milione senza dover cambiare identità.
- **Il criterio di selezione non è il pregio dell'immobile, è il potenziale di margine sulla rivendita.** Evita "immobili di pregio" come descrizione del criterio di scelta: non è la prestigiosità dell'immobile a contare, ma quanto valore si può creare ristrutturandolo rispetto al prezzo di acquisto. Un appartamento comune, in una posizione con margine di miglioramento, può valere anche il triplo una volta ristrutturato, ed è un'operazione INNvesting tanto quanto una villa storica. Usa invece formule come "immobili ad alto potenziale" o "immobili ad alto potenziale di rivalutazione", e quando possibile porta un esempio concreto del tipo di occasione (come nella fase "Ricerca riservata" di "Come funziona"), non una definizione astratta.

## Voce narrativa: quando "noi" e quando "io"

Andrea collabora con una rete di geometri, architetti, imprese e agenzie: per questo motivo il sito non parla sempre in prima persona singolare. Usare il plurale dove serve trasmette affidabilità (non un singolo operatore isolato, ma una squadra), ma non va applicato meccanicamente ovunque, altrimenti si perde la promessa di "un solo referente" che è un altro punto di forza del posizionamento. La regola pratica:

- **"Noi" è la voce di default**, anche per frasi con "personalmente" (es. "selezioniamo personalmente"): l'obiettivo è trasmettere una squadra, non un operatore isolato, e "personalmente" non è un motivo sufficiente per tornare al singolare. Copre tutto ciò che descrive il lavoro operativo: ricerca tramite la rete di agenzie, individuazione di geometra/architetto, coordinamento del cantiere con imprese e fornitori, selezione di finiture e arredi, gestione della rivendita. Sono le sezioni "Come funziona", "Come lavoriamo" e la parte finale dell'hero ("Tu decidi, ci pensiamo noi", coerente con il "We create value" del payoff).
- **"Io"** resta solo dove il messaggio è la responsabilità individuale di Andrea, non il lavoro di squadra:
  - la biografia in "Chi sono" (è la storia personale di Andrea, non del team);
  - tutto ciò che riguarda il compenso e l'allineamento di interessi (in "Chi sono", dove si spiega che la remunerazione è una percentuale sulle fasi del lavoro, mai dai fornitori): è la remunerazione personale di Andrea, ed è lui il garante di quell'allineamento;
  - la promessa di risposta diretta nei contatti ("Rispondo personalmente a ogni richiesta").
- Se in dubbio su un nuovo testo: chiediti se stai descrivendo l'esecuzione operativa (→ noi, anche con "personalmente") o un impegno/responsabilità individuale di Andrea legato a compenso o biografia (→ io). Non mescolare i due registri nella stessa frase.

## Copywriting

Scrivi come lo scriverebbe un copywriter italiano esperto, non come lo produrrebbe un modello linguistico. In concreto:

- **Niente pattern tipici da AI**: evita i trattini lunghi (em-dash) come struttura portante della frase, evita sequenze di frasi brevissime e telegrafiche una dopo l'altra, evita di chiudere i periodi con negazioni a effetto ("...non è solo X, è Y" ripetuto ovunque). Varia la lunghezza delle frasi come farebbe una persona che scrive di getto.
- Evita connettivi di riempimento usati come tic ("quindi", "inoltre", "infatti") quando non servono a costruire un ragionamento reale.
- Preferisci dettagli concreti (numeri, nomi di brand, esempi reali) a superlativi generici ("di altissima qualità", "un'esperienza unica").
- Mantieni un registro coerente: ci si rivolge sempre al cliente in modo diretto ("tu"), mai a metà tra formale e diretto nello stesso paragrafo.
- Rileggi ogni frase chiedendoti "la scriverebbe davvero una persona, così?" Se suona costruita o simmetrica in modo innaturale, riscrivila.
- Italiano corretto e completo di accenti (città, più, già, né, è, età...): mai versioni senza accento, anche per compatibilità tecnica non è mai un buon motivo.

## Codice

- Niente codice spaghetti. Struttura chiara, leggibile, mantenibile come lo scriverebbe uno sviluppatore senior.
- Organizza gli asset per tipo, in cartelle dedicate: `css/` per gli stili, `js/` per lo javascript, `images/` per la grafica. Non accumulare tutto nella root né mescolare i tipi di file.
- **Niente stili inline (`style="..."`).** Tutte le pagine (`index.html`, `caso-*.html`) sono state rifattorizzate per usare solo classi CSS definite in [css/styles.css](css/styles.css), sezione "INNvesting site — page components". Qualunque nuova sezione o modifica va fatta allo stesso modo: aggiungi/estendi una classe nel CSS invece di scrivere `style="..."` nell'HTML, anche per un singolo valore. Le classi seguono una convenzione a blocchi (es. `.hero`, `.hero__title`, `.fee-card`, `.fee-card--highlight`): riusa i blocchi esistenti quando il pattern visivo si ripete, crea un nuovo blocco solo per pattern realmente nuovi.
- Nomi di file e classi coerenti e descrittivi, in minuscolo con trattini (kebab-case).
- Percorsi sempre relativi (mai assoluti con `/` iniziale), per restare compatibili sia con l'anteprima locale sia con GitHub Pages.

## Design

- Grafica curata, moderna e accattivante, ma sempre usabile: leggibilità, contrasto e gerarchia visiva vengono prima dell'effetto estetico.
- Rispetta la palette e la tipografia già definite in [css/styles.css](css/styles.css) (variabili `--color-*`, `--font-*`) invece di introdurne di nuove senza motivo.
- Verifica sempre il risultato in versione mobile, non solo desktop.

## Note operative

- `.claude/launch.json` avvia un piccolo server statico locale (PowerShell, porta 5500) per l'anteprima nel browser integrato: il browser integrato apre i file `file://` come snapshot statico e non carica le immagini, quindi per verificare le modifiche visivamente serve sempre il server.
- `Versione2/` e `Versione 3/` sono cartelle di lavoro/bozze locali, escluse da git (vedi `.gitignore`): non vanno mai pubblicate né usate come riferimento definitivo, ma possono contenere asset utili (es. loghi) da recuperare.
- Il sito è pubblicato su GitHub Pages da `main` — non servono build step, è HTML statico puro.
