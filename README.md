# Gestore Pub

Gestore Pub è un'applicazione desktop per la gestione di soci, tessere QR,
presenze, rinnovi, backup e report di un club privato.

È pensata per un utilizzo locale: i dati restano sul computer dell'utente, senza
telemetria e senza servizi cloud obbligatori.

## Chi Sono

Sono **Francesco Dell'Orto**, studente del liceo scientifico.

Ho sviluppato questo progetto come lavoro personale, con l'obiettivo di
realizzare un'applicazione concreta, installabile e comprensibile anche da chi
la usa senza conoscenze tecniche.

## Uso Dell'AI

Durante lo sviluppo ho usato strumenti di intelligenza artificiale come supporto
puntuale, soprattutto per rifinire alcune parti del frontend, rivedere problemi
di codice e migliorare la documentazione.

Il progetto non è stato generato automaticamente: struttura, funzionalità,
verifiche e scelte finali sono state seguite e adattate manualmente.

## Cosa Fa

- crea e gestisce i soci del club;
- genera tessere con QR code;
- registra le presenze tramite scanner QR;
- gestisce scadenze e rinnovi annuali;
- esporta backup, CSV e PDF;
- permette il recupero password tramite domanda personale;
- funziona come app desktop per Windows, macOS e Linux.

## Installazione Per Chi Usa L'App

La versione pronta da usare si scarica dalla pagina:

[GitHub Releases](https://github.com/Francy2009/Gestore-pub/releases)

Scegli il file adatto al tuo sistema:

- Windows: installer `.msi` o `.exe`;
- macOS: file `.dmg`;
- Linux: `.AppImage`, `.deb` o `.rpm`.

Al primo avvio l'app crea automaticamente il database locale e apre la
configurazione dell'account amministratore. Non bisogna preparare database,
server o file a mano.

## Primo Avvio

Quando il database è vuoto, l'app crea un account amministratore iniziale e
chiede di configurare:

- username;
- password robusta;
- domanda personale;
- risposta di recupero.

La risposta di recupero viene salvata come hash, non in chiaro. Serve nel caso
in cui l'amministratore dimentichi la password.

## Dove Vengono Salvati I Dati

Nella versione desktop i dati vengono salvati in locale, nella cartella dati
dell'app, dentro un file chiamato:

```text
desktop-db.json
```

Questo file viene creato automaticamente. Se una versione precedente aveva dati
nel `localStorage` della WebView, la nuova versione li migra automaticamente nel
file locale dell'app.

L'app non invia dati a server esterni e non usa analytics.

## Backup Ed Export

Dalle impostazioni admin si possono esportare backup e file di lavoro.

I file generati finiscono di default nella cartella Download. In alcuni ambienti
è possibile scegliere una cartella personalizzata.

Attenzione: i backup possono contenere dati personali, token QR e informazioni
sui soci. Vanno conservati con cura, meglio su un supporto protetto o cifrato.
Non vanno caricati in chat pubbliche, email non protette o cloud non affidabili.

## Sicurezza

L'app include alcune protezioni pensate per un uso reale locale:

- password salvate con hash PBKDF2-SHA512;
- risposta di recupero salvata come hash separato;
- database desktop fuori dal `localStorage` della WebView;
- Content Security Policy nel bundle Tauri;
- backup standard senza hash password o hash risposta recupero;
- protezioni contro CSV formula injection;
- nessuna telemetria o tracking.

L'app è pensata per essere usata su un computer gestito da una persona fidata.
Non sostituisce buone pratiche come account del sistema operativo protetti,
backup sicuri e attenzione nel condividere file o QR code.

Per maggiori dettagli tecnici vedi:

- [PRIVACY.md](PRIVACY.md)
- [SECURITY_AUDIT_REPORT.md](SECURITY_AUDIT_REPORT.md)

## Sviluppo Locale

Requisiti principali:

- Node.js;
- npm;
- Rust e Cargo, solo per compilare l'app desktop Tauri.

Installa le dipendenze:

```bash
npm install
```

Avvia in sviluppo web:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Build frontend per Tauri:

```bash
npm run build:tauri
```

Build desktop Tauri:

```bash
cd src-tauri
cargo tauri build
```

Gli installer vengono generati in:

```text
src-tauri/target/release/bundle/
```

## Test

```bash
npm test
```

Al momento i test coprono soprattutto il primo avvio desktop, la creazione
automatica del database locale, la migrazione dal vecchio storage e il reset
dati dell'app.

## Struttura Del Progetto

```text
src/          interfaccia, route e logica applicativa
src/lib/      API, auth, export, storage desktop
src-tauri/    configurazione e comandi Rust per app desktop
prisma/       schema e migrazioni per la modalità server/sviluppo
public/       asset statici
```

## Note Di Consegna

Questa app è pensata per essere distribuita tramite GitHub Releases come
applicazione desktop locale.

Prima di pubblicare una nuova versione conviene sempre eseguire:

```bash
npm test
npm run build
npm run build:tauri
```

La compilazione nativa Tauri viene verificata dal workflow GitHub Actions sulle
piattaforme supportate.

## Licenza

Il progetto è distribuito con licenza MIT. Vedi [LICENSE](LICENSE).
