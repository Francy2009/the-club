# The Club

🔗 **Sito web**: https://francy2009.github.io/the-club/

The Club è un'app desktop per gestire soci, tessere QR, presenze e rinnovi di un club privato.

Tutto resta sul tuo computer: niente cloud, niente telemetria, niente account da creare su qualche server. L'unica comunicazione di rete è il controllo aggiornamenti all'apertura (interroga l'API pubblica di GitHub; nessun dato personale o dei soci viene inviato) — l'app funziona comunque offline.

> ⚠️ **Avviso di sicurezza — versione Linux non più distribuita**
>
> A partire dalla versione **1.1.0** non rilasciamo più i pacchetti per Linux. Il motivo, in parole semplici: su Linux l'app si appoggia a una libreria di sistema (`glib`, usata dal framework Tauri) che aveva un **bug di sicurezza** noto. Non potevamo aggiornarla da soli, perché la versione con la correzione dipende da un aggiornamento del framework ancora non disponibile.
>
> Piuttosto che distribuire un software con un problema di sicurezza conosciuto, abbiamo preferito **sospendere il supporto Linux** in attesa che il framework renda disponibile la correzione. Su Windows e macOS l'app non è coinvolta: quella libreria non viene nemmeno inclusa, e tutto continua a funzionare come prima.

## Chi sono

Siamo **Francesco Dell'Orto** e **Roberto Brenna**, due studenti del liceo scientifico. Abbiamo costruito questa app perché ci serviva uno strumento concreto per un club locale — qualcosa che si installa, si apre e funziona, senza dover configurare un server o pagare un abbonamento.

Abbiamo usato strumenti di intelligenza artificiale come supporto durante lo sviluppo, soprattutto per il frontend e la documentazione, ma le decisioni, la struttura e le verifiche sono nostre.

## Cosa fa

- Crea e gestisce i soci del club
- Genera tessere con QR code
- Registra le presenze tramite scanner QR (o ricerca manuale per nome)
- Gestisce scadenze e rinnovi annuali
- Esporta backup JSON, CSV e PDF
- Recupero password tramite domanda personale
- Funziona su Windows e macOS

## Installazione

Vai su [GitHub Releases](https://github.com/Francy2009/The-Club/releases) e scarica il file giusto per il tuo sistema:

- **Windows**: file `.msi` o `.exe` — doppio clic per installare
- **macOS**: file `.dmg` — trascina l'app in Applicazioni

Al primo avvio l'app crea il database da sola e ti chiede di configurare l'account amministratore (username, password, domanda di recupero). Non serve preparare nulla a mano.

## Aggiornamento

Quando esce una nuova versione, l'app ti avvisa automaticamente all'apertura con un banner in alto. Clicca **"Apri release"** per aprire la pagina GitHub nel browser.

Per aggiornare:

1. Scarica il nuovo installer dalla pagina GitHub Releases
2. Installalo sopra la versione precedente.
3. Riapri l'app

Non c'è bisogno di disinstallare prima: l'installer sostituisce la vecchia versione mantenendo i dati intatti.

## Disinstallazione

Se vuoi rimuovere completamente l'app **e tutti i suoi dati**:

1. Apri l'app, vai su **Impostazioni → Rimuovi dati locali** e clicca "Elimina tutti i dati locali"
2. Disinstalla l'app dal sistema (Pannello di controllo su Windows, Applicazioni su macOS)

Se disinstalli solo l'app senza passare dal pulsante nelle impostazioni, i dati restano nella cartella dati del sistema. Puoi eliminarli manualmente:

- **Windows**: `%APPDATA%\com.the.club\`
- **macOS**: `~/Library/Application Support/com.the.club/`

## Dove finiscono i dati

Nella versione desktop, tutto viene salvato in un file chiamato `desktop-db.json` nella cartella dati dell'app. L'app non invia nulla a server esterni.

## Backup

Dalle impostazioni admin puoi esportare backup completi (JSON) o fogli di calcolo (CSV). I file finiscono nella cartella Download.

I backup contengono dati personali e token QR: conservali su un supporto sicuro, non in chat pubbliche o cloud non affidabili.

## Sicurezza

- Password con hash PBKDF2-SHA512
- Domanda e risposta di recupero salvate come hash (anche nel file desktop a partire da v1.1.1)
- Content Security Policy nel bundle Tauri
- Rate limiting persistente in modalità desktop
- Audit log delle azioni amministrative
- Backup standard senza hash password
- Protezione contro CSV formula injection
- Nessuna telemetria o tracking

Per dettagli tecnici: [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md)

## Sviluppo

Requisiti: Node.js, npm, Rust/Cargo (solo per la build desktop).

```bash
npm install          # dipendenze
npm run dev          # sviluppo web su localhost:3000
npm run build        # build frontend
npm run build:tauri  # build frontend + asset Tauri
npm test             # test
```

Per la build desktop completa:

```bash
cd src-tauri
cargo generate-lockfile
cargo tauri build
```

Gli installer finiscono in `src-tauri/target/release/bundle/`.

## Struttura

```
src/          interfaccia, route e logica
src/lib/      API, auth, export, storage desktop
src-tauri/    configurazione e comandi Rust
prisma/       schema e migrazioni (modalità server/sviluppo)
public/       asset statici, favicon, manifest
```

## Licenza

Licenza MIT — vedi [LICENSE](LICENSE).

Il software è fornito "così com'è" (AS IS), senza garanzia di alcun tipo. L'autore non è responsabile di danni derivanti dall'uso del software. L'utente è responsabile della gestione sicura dei propri dati.

La documentazione di questo progetto (README, PRIVACY.md, SECURITY.md) descrive il comportamento tecnico del software e non costituisce consulenza legale. Per la conformità a normative privacy (GDPR o altre) rivolgersi a un consulente qualificato.
