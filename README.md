# DayByDay — Backend

**Autore:** Giulia Pompilii  
**Tecnologie:** Node.js · Express · Prisma 6.10.1 · MongoDB Atlas · JWT · bcrypt · node-cron

---

## Descrizione

Backend REST API di DayByDay, un'app di calendario e agenda, sia personale sia condivisa con altri utenti.
Permette di gestire calendari, membri e inviti, eventi (anche ricorrenti), tag, to-do con i loro elementi, note, preferenze di vista e notifiche.

---

## Requisiti

- Node.js 18 o superiore
- npm
- Un database MongoDB (il progetto usa MongoDB Atlas)

---

## Installazione

### 1. Clona il repository

```bash
git clone <url-repository>
cd Progetto-inizio-anno-BE
```

### 2. Installa le dipendenze

```bash
npm install
```

### 3. Configura le variabili d'ambiente

Il file `.env` viene fornito separatamente. Posizionarlo nella cartella root del progetto (vedi [Variabili d'ambiente](#variabili-dambiente)).

### 4. Genera il client Prisma e crea gli indici

```bash
npx prisma generate
npx prisma db push
```

`prisma generate` crea il client nella cartella `generated` (che non è nel repository), `prisma db push` crea su MongoDB gli indici univoci (es. email dell'utente, nome del tag nello stesso calendario).

### 5. Avvia il server

```bash
npm run dev
```

Il server sarà disponibile su `http://localhost:3000`.

All'avvio:

- - il database viene **popolato automaticamente** con i dati demo, ma solo se è vuoto: se è già popolato non viene toccato, quindi i dati creati dopo (da Postman o dal frontend) restano
- partono due **cron job**: il controllo degli avvisi degli eventi ogni minuto e la pulizia delle notifiche lette ogni notte alle 3:00

### Utente demo

Le credenziali di un utente demo, con calendari, eventi, to do e note già pronti, vengono fornite separatamente via email.

## Struttura del progetto

```
Progetto-inizio-anno-BE/
├── server.js                    # Avvio: server, seed e cron job
├── app.js                       # Express: CORS, JSON, rotte, errori 404 e body non valido
├── prisma/                      # Schema Prisma
├── src/
│   ├── routes/                  # Rotte di ogni modulo
│   ├── controllers/             # Leggono la richiesta e mandano la risposta
│   ├── services/                # Logica e controlli
│   ├── repository/              # Accesso al database con Prisma
│   ├── middleware/
│   │   └── autenticazione_middleware.js   # Verifica del token
│   ├── eccezioni/
│   │   ├── app_eccezioni.js     # AppException (messaggio + status)
│   │   └── gestisci_errore.js   # Trasforma gli errori in risposte JSON
│   └── persistence/
│       ├── db_config.js         # Connessione al database
│       └── utility/             # Seed con i dati demo (popola_db.js e loader)
├── docs/
│   ├── analisi/                 # Documento di analisi (Excalidraw e PNG)
│   └── postman/                 # Collection Postman
├── package.json
└── .gitignore
```

---

## API Endpoints principali

Tutte le rotte, tranne registrazione, login e rinnovo del token, richiedono l'access token nell'header
(il rinnovo usa invece il refresh token, mandato nel body):

```
Authorization: Bearer <token>
```

L'elenco completo, con gli esempi di risposta e di errore, è nella collection Postman in `docs/postman`.

### Utenti

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/utenti/registrazione` | Registrazione |
| POST | `/utenti/login` | Login: restituisce `token`, `refreshToken` e `utente` |
| POST | `/utenti/rinnova` | Nuovo access token tramite il refresh token |
| GET | `/utenti/dettagli/:id` | Profilo (l'email si vede solo nel proprio) |
| PUT | `/utenti/modifica/:id` | Modifica profilo (per la password serve `password_attuale`) |
| DELETE | `/utenti/elimina/:id` | Eliminazione account |
| GET | `/utenti/oggi` | Riepilogo di oggi: eventi, to-do da fare e note di tutti i calendari |

### Calendari

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/calendari/crea` | Crea calendario personale o condiviso |
| GET | `/calendari/lista` | Calendari dell'utente |
| GET | `/calendari/dettagli/:id` | Dettaglio calendario |
| PUT | `/calendari/modifica/:id` | Modifica calendario |
| DELETE | `/calendari/elimina/:id` | Elimina calendario e tutto il suo contenuto |
| POST | `/calendari/invita/:id` | Invita un utente tramite email |
| PUT | `/calendari/stato-invito/:id/:utenteId` | Accetta o rifiuta l'invito |
| PUT | `/calendari/permesso-modifica/:id/:utenteId` | Permesso di modifica di un membro |
| DELETE | `/calendari/rimuovi-membro/:id/:utenteId` | Rimuove un membro |

### Eventi

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/eventi/crea` | Crea evento, anche ricorrente |
| GET | `/eventi/dettagli/:id` | Dettaglio evento |
| GET | `/eventi/lista/:calendarioId?da=&a=` | Eventi di un calendario, filtrabili per periodo |
| GET | `/eventi/lista-tag/:tagId` | Eventi con un tag |
| PUT | `/eventi/modifica/:id` | Modifica solo questa occorrenza |
| PUT | `/eventi/modifica-serie/:id` | Modifica tutta la serie |
| DELETE | `/eventi/elimina/:id` | Elimina solo questa occorrenza |
| DELETE | `/eventi/elimina-serie/:id` | Elimina tutta la serie |
| POST | `/eventi/aggiungi-tag/:id` | Aggiunge un tag a un evento |
| DELETE | `/eventi/rimuovi-tag/:id` | Rimuove un tag da un evento |
| POST | `/eventi/aggiungi-tag-serie/:id` | Aggiunge un tag a tutta la serie |
| DELETE | `/eventi/rimuovi-tag-serie/:id` | Rimuove un tag da tutta la serie |

### Altri moduli

| Prefisso | Modulo |
|----------|--------|
| `/tags` | Tag di un calendario |
| `/todos` | To-do (giornaliere, settimanali, mensili), rinvio e resoconto |
| `/elementi-to-do` | Elementi di una to-do: crea, modifica, completa, elimina |
| `/note` | Note (giornaliere, settimanali, mensili) |
| `/preferenze-vista` | Vista preferita di ogni calendario |
| `/notifiche` | Notifiche dell'utente |

---

## Scelte importanti del progetto

### Scelta della versione di Prisma

Per questo progetto ho scelto di utilizzare Prisma nella versione 6.10.1, invece dell'ultima versione disponibile al momento dello sviluppo (Prisma 7), per un motivo tecnico decisivo: Prisma ORM 7 non supporta ancora MongoDB, il database scelto per questo progetto. L'utilizzo di questa versione avrebbe reso impossibile il collegamento tra Prisma e il database.

Tra le versioni della serie 6 (pienamente compatibili con MongoDB), ho scelto nello specifico la 6.10.1, precedente alla versione 6.18, per evitare una complessità aggiuntiva introdotta a partire da quest'ultima: dalla versione 6.18 in poi, infatti, il comando `prisma init` genera automaticamente, oltre ai file necessari (`schema.prisma` e `.env`), anche un file di configurazione aggiuntivo (`prisma.config.ts`) e alcune cartelle dedicate all'integrazione con assistenti di intelligenza artificiale per la scrittura del codice (come Claude Code o Cursor), insieme a uno script automatico (`postinstall`) che mantiene sincronizzate queste funzionalità ad ogni installazione.

Queste funzionalità, seppur non compromettenti per il funzionamento del progetto, introducono file, cartelle e concetti aggiuntivi non necessari per il mio caso d'uso. Con la versione 6.10.1, invece, il comando `prisma init` genera solamente i due file essenziali (`schema.prisma` e `.env`), garantendo una struttura più semplice, lineare e coerente con le reali necessità del progetto.

**Conferma pratica della scelta.** Durante l'installazione ho riscontrato una conferma concreta di questa scelta: installando inizialmente l'ultima versione disponibile di Prisma, npm segnalava 13 vulnerabilità (5 moderate, 8 alte) nelle dipendenze interne del pacchetto. Effettuando invece l'installazione con la versione 6.10.1, il risultato è stato di 0 vulnerabilità rilevate, confermando che si tratta di una versione più stabile e sicura per il mio progetto.

### Architettura a 4 livelli

Ogni modulo è diviso in **routes → controllers → services → repository**:

- le **routes** collegano indirizzo, middleware di autenticazione e controller
- i **controller** leggono la richiesta e mandano la risposta, senza logica
- i **service** contengono i controlli e la logica (permessi, validazione dei dati, date)
- i **repository** sono l'unico punto che parla con il database tramite Prisma

### Gestione degli errori

Tutti gli errori rispondono sempre con la stessa forma JSON:

```json
{ "errore": "Messaggio leggibile dall'utente" }
```

- nei service gli errori previsti vengono lanciati con `AppException`, una classe che estende `Error` aggiungendo lo status HTTP
- nei controller `gestisciErrore` riconosce le `AppException` e usa il loro messaggio e status, traduce gli errori di Prisma noti (id scritto male --> 400 "Id non valido") e trasforma tutti gli altri in un 500 con un messaggio generico, senza mai mostrare il testo tecnico di Prisma
- in `app.js` due gestori finali rispondono in JSON anche alle rotte che non esistono (404 "Rotta non trovata") e ai body JSON scritti male (400 "Body JSON non valido"), che non arrivano mai ai controller

### Autenticazione e sessioni

- le password sono salvate solo cifrate con **bcrypt**; per cambiarla serve la password attuale
- al login vengono creati un **access token JWT** (valido 1 ora) e un **refresh token**, salvato nel database con il dispositivo da cui è stato fatto l'accesso (es. "Computer di Giulia"), rilevato automaticamente dallo user agent
- quando l'access token scade, il backend risponde **401 "Token scaduto"** e il frontend ne chiede uno nuovo con `POST /utenti/rinnova`
- gli errori di dati sbagliati (anche "password attuale non corretta") usano 400 e non 401, perché nel frontend il 401 è riservato al rinnovo del token

### Calendari condivisi e permessi

- un calendario può essere **personale** o **condiviso**; solo quelli condivisi hanno membri
- l'amministratore invita gli utenti per email; l'invito può essere in attesa, accettato o rifiutato (dopo un rifiuto si può reinvitare)
- vedono il contenuto solo l'amministratore e i membri che hanno accettato; chi può modificarlo dipende dal permesso del calendario (solo amministratore, tutti o personalizzato per membro)

### Eventi ricorrenti

- ogni ripetizione è salvata come **evento a sé**: il primo è il "padre", gli altri hanno `evento_padre_id` uguale al suo id. Così si può modificare o eliminare **solo una occorrenza** oppure **tutta la serie**
- le occorrenze tengono lo **stesso orario italiano** anche quando cambia l'ora legale (fuso `Europe/Rome`)
- per mensile e annuale, se il giorno non esiste in quel mese (es. il 31 a febbraio) si usa l'ultimo giorno del mese
- senza data di fine le occorrenze si generano per un massimo di 1 anno (giornaliera), 2 (settimanale), 3 (mensile) o 5 (annuale), che sono anche il limite massimo per la data di fine
- un evento che si ripete deve finire prima della ripetizione successiva (es. una giornaliera deve durare meno di 24 ore), altrimenti le ripetizioni si sovrapporrebbero; gli eventi di tutto il giorno non sono interessati

### Prestazioni delle serie lunghe

Una serie giornaliera di un anno ha circa 366 eventi. Creandoli, modificandoli o eliminandoli uno alla volta, le transazioni superavano il limite di 60 secondi. Per questo le operazioni sulle serie lavorano **tutte le occorrenze insieme**:

- creazione con `createMany`
- modifica dei dati comuni con `updateMany`, e spostamento delle date con un unico comando MongoDB (`$runCommandRaw`)
- eliminazione con `deleteMany`
- aggiunta e rimozione dei tag su tutta la serie con `updateMany`

Così una serie di un anno viene gestita in un paio di secondi.

### Relazioni molti-a-molti su MongoDB

Eventi e calendari, ed eventi e tag, sono collegati **da tutti e due i lati** (`calendario_ids` nell'evento ed `evento_ids` nel calendario, `tag_ids` nell'evento ed `evento_ids` nel tag). Con `connect` e `disconnect` Prisma aggiorna entrambi i lati; nelle operazioni di massa (`createMany`, `updateMany`, `deleteMany`), che non li supportano, entrambi i lati vengono aggiornati a mano.

### Transazioni

Le operazioni che toccano più dati insieme sono in **un'unica transazione** (o va a buon fine tutto, o niente), per esempio:

- **eliminazione di un calendario**: vengono eliminati to-do ed elementi, note, tag, preferenze, notifiche ed eventi solo di quel calendario; gli eventi presenti anche in altri calendari restano
- **eliminazione dell'account**: i calendari personali, e quelli condivisi in cui nessuno ha accettato l'invito, vengono eliminati; quelli condivisi con almeno un membro passano al primo che ha accettato, che diventa amministratore; tutto quello che l'utente ha creato resta, con `creato_da = null` (nel frontend "Utente eliminato")

### Date

- gli **eventi** hanno data e ora complete, salvate in UTC
- **note e to-do** hanno solo la data (`AAAA-MM-GG`), salvata all'inizio del loro periodo: il giorno per le giornaliere, il lunedì per le settimanali, il giorno 1 per le mensili

### Notifiche e cron job

- le notifiche vengono create in automatico per inviti, rimozioni, uscite, eliminazione di un calendario, nuovo amministratore e avvisi degli eventi
- ogni minuto un cron job crea gli **avvisi degli eventi** che stanno per iniziare; se il server era spento, al riavvio recupera gli avvisi mancati, indicando i minuti che mancano davvero
- ogni notte alle 3:00 un cron job elimina le **notifiche già lette**

### Chi ha creato e modificato

Ogni elemento salva chi l'ha creato e chi l'ha modificato per ultimo, con le date. Quando si crea, modifica, completa o elimina un elemento di una to-do, anche la to-do risulta modificata da chi ha fatto l'operazione.

---

## Dipendenze principali

- **express** — framework per la creazione delle API REST
- **cors** — permette al frontend di chiamare le API
- **dotenv** — per la gestione sicura delle variabili d'ambiente, separate dal codice sorgente
- **prisma** (versione 6.10.1) — ORM utilizzato come strumento di sviluppo (CLI) per la gestione dello schema del database e la generazione del client
- **@prisma/client** (versione 6.10.1) — libreria utilizzata dal codice per interagire effettivamente con il database
- **bcrypt** — cifratura delle password
- **jsonwebtoken** — creazione e verifica dei token JWT
- **ua-parser-js** — riconoscimento del dispositivo da cui si fa il login
- **node-cron** — esecuzione automatica degli avvisi e della pulizia delle notifiche

### Comandi di installazione utilizzati

```bash
npm init -y
npm install express dotenv
npm install prisma@6.10.1 --save-dev
npm install @prisma/client@6.10.1
npx prisma init
npm install bcrypt jsonwebtoken ua-parser-js node-cron cors
```

---

## Test con Postman

La collection si trova in `docs/postman/DAYBYDAY.postman_collection.json`:

1. importarla in Postman
2. avviare il server con `npm run dev`
3. eseguire il login di un utente: lo script della richiesta salva il token nelle variabili della collection
4. eseguire le altre richieste; ogni richiesta ha esempi salvati delle risposte corrette e degli errori

---

## Documento di analisi

Il documento di analisi si trova in `docs/analisi`, sia come file Excalidraw modificabile sia come immagine PNG.

---

## Variabili d'ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `DATABASE_URL` | Connection string di MongoDB |
| `SECRET_KEY` | Chiave segreta per i token JWT |
