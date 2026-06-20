# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [1.0.22] - 2026-06-20

### Modificato
- Rinominato progetto e repository in `the-club`; aggiornati nomi file, link GitHub, identificatore Tauri e chiavi locali.
- Migliorato avviso aggiornamenti: controllo automatico ogni ora con persistenza del dismiss per versione.

### Sicurezza
- Aggiornato `.gitignore` per escludere backup ed export con il nuovo nome `the-club-*`.
- Verificata assenza di secret, credenziali o database locali nel repository.

## [1.0.21] - 2026-06-20

### Corretto
- Controllo aggiornamenti eseguito a ogni avvio senza blocco temporale locale.
- Richiesta GitHub Releases forzata senza cache per evitare risultati obsoleti nel runtime desktop.

## [1.0.20] - 2026-06-20

### Corretto
- Avviso aggiornamenti reso piu affidabile anche quando la globale Tauri non e disponibile nel frontend.
- Controllo aggiornamenti legato alla versione installata e ridotto a intervalli piu brevi, evitando che un controllo precedente blocchi l'avviso per troppe ore.
- Aggiunto test di regressione per riconoscere release piu nuove con tag di test come `v1.0.20-test`.

## [1.0.19] - 2026-06-20

### Aggiunto
- Avviso desktop non invasivo quando una nuova GitHub Release e disponibile.
- Versione applicazione dichiarata anche in `package.json` e `package-lock.json`.

### Modificato
- Dipendenze aggiornate tramite Dependabot: TanStack Router, TanStack SSR Query, TanStack Devtools Vite, Vitest e Tailwind Typography.
- TanStack Start e Router Plugin allineati a versioni compatibili con il nuovo Router per ripristinare il prerender Tauri.
- Workflow GitHub Actions aggiornati tramite Dependabot.
- Security policy rifinita per la pubblicazione open source.

## [1.0.18] - 2026-06-19

### Aggiunto
- CI su pull request e push con audit npm, typecheck, test e build.
- Dependabot per dipendenze npm, Cargo e GitHub Actions.
- Pin della toolchain Rust stabile tramite `rust-toolchain.toml`.
- Workflow release rafforzato con audit, typecheck, test, generazione lockfile Cargo e `cargo check` prima del packaging Tauri.
- Pannello reset dati locali disponibile anche nella home da sloggati, con conferma `RESETTA L'APP` e flag esplicito in sviluppo web.

### Modificato
- Recupero account reso piu prudente contro username enumeration: risposta generica e validazione effettiva solo nel flusso di recupero.
- Documentazione sicurezza/privacy aggiornata per GitHub Release e comportamento reale dei backup.
- Script demo aggiornato per non usare password debole hardcoded.

### Sicurezza
- Limiti dimensione e validazione aggiunti per database/export Tauri.
- Apertura cartella export Tauri vincolata alla cartella Download dopo canonicalizzazione del percorso.
- File locali sensibili, database, backup ed export esclusi dal tracking Git.
- Bundle desktop reso self-contained rimuovendo il caricamento runtime di font remoti.

## [1.0.17] - 2026-06-18

### Modificato
- Preparazione della versione desktop 1.0.17 con aggiornamento metadati Tauri.

## [1.0.16] - 2026-06-17

### Modificato
- Reset database desktop reso piu sicuro: ora richiede la frase `RESETTA L'APP` prima di cancellare i dati locali.
- Testi della schermata backup aggiornati per chiarire che l'export standard non contiene hash password o hash recupero.

### Sicurezza
- Rimossa l'esportazione completa con credenziali dalle API pubbliche e dal bundle client.
- Restore dei backup standard allineato al flusso di setup admin, evitando account ripristinati con credenziali non note.

## [1.0.15] - 2026-06-17

### Aggiunto
- Database desktop Tauri salvato automaticamente in un file locale nella cartella dati dell'app.
- Migrazione automatica dal vecchio database in `localStorage` al nuovo file dati desktop.
- Test di regressione per migrazione storage desktop e reset database Tauri.

### Modificato
- Reset app desktop aggiornato per cancellare il file database Tauri senza cancellare preferenze locali non correlate.
- README, privacy policy e report sicurezza allineati allo storage desktop reale.
- README riscritto in modo piu chiaro e sobrio, con note sull'autore e sull'uso dell'AI.

## [1.0.14] - 2026-06-17

### Aggiunto
- Salvataggio export desktop nella cartella Download tramite comandi Tauri, con dialog di conferma e apertura cartella.

### Corretto
- Gli export desktop non sovrascrivono piu file esistenti: vengono creati nomi progressivi.
- L'apertura della cartella export e limitata alla cartella Download gestita dall'app.

## [1.0.13] - 2026-06-16

### Modificato
- Recupero password semplificato con domanda personale e risposta breve hashata al posto della frase lunga a 3 parole.

## [1.0.12] - 2026-06-16

### Aggiunto
- Pulsante di reset dati locali nella schermata iniziale desktop Tauri, con conferma e ritorno alla configurazione admin iniziale.
- Appunti locali Codex ignorati da git per riprendere il contesto di lavoro senza pubblicare note operative.

### Rimosso
- Riquadro tecnico "Se resti fuori" dalle impostazioni admin, lasciando il recupero password tramite flusso dedicato come percorso principale.

## [1.0.11] - 2026-06-15

### Aggiunto
- Build release Linux con pacchetto `.rpm` per Fedora/RHEL, includendo `rpm` nelle dipendenze GitHub Actions.

## [1.0.10] - 2026-06-15

### Corretto
- Configurazione Tauri v2 valida rimuovendo la chiave legacy `allowlist` che bloccava le build GitHub Actions.

## [1.0.9] - 2026-06-15

### Aggiunto
- Frase di recupero amministratore con hash separato.
- Rate limiting persistente su SQLite per login e recupero password.
- Middleware CSRF globale per richieste non-GET.
- Backup standard senza hash password/frase recupero e report di audit sicurezza.
- Test desktop per bootstrap primo avvio.

### Corretto
- Percorsi login/recupero uniformati per ridurre username enumeration.
- Rotazione sessione su login, cambio password e cambio frase recupero.
- DevTools esclusi dalla build produzione.
- CSP Tauri abilitata.

## [1.0.8] - 2026-06-08

### Corretto
- AppImage desktop con autenticazione e dati locali senza chiamare server functions non disponibili.
- Validazione dello stato utente per evitare profili corrotti con valori `undefined` e date non valide.
- Stato iniziale TanStack serializzato senza byte NUL grezzi nell'HTML desktop.
- Testi residui dello starter rimossi dalle schermate pubbliche.

## [1.0.7] - 2026-06-08

### Corretto
- AppImage Linux con finestra bianca causata dal rendering WebKitGTK su alcune configurazioni grafiche.

## [1.0.6] - 2026-06-08

### Corretto
- Riscrittura post-build degli asset TanStack Start per caricare correttamente il JavaScript nell'AppImage.

## [1.0.5] - 2026-06-08

### Corretto
- AppImage Linux con schermata bianca usando asset relativi nella build Tauri.

## [1.0.4] - 2026-06-08

### Corretto
- Schema `tauri.conf.json` per Tauri v2: `infoPlist` ora usa un file `.plist`.
- Configurazione NSIS semplificata rimuovendo stringhe non supportate.

## [1.0.3] - 2026-06-08

### Corretto
- Build macOS Apple Silicon impostando il deployment target minimo a macOS 11.0.
- Runner GitHub Actions macOS separati per Apple Silicon e Intel.

## [1.0.1] - 2026-06-08

### Corretto
- Build release Tauri con output SPA statico per il bundle desktop.
- Workflow GitHub Actions release con target Rust macOS corretti.
- Configurazione Tauri semplificata con asset icona validi.

### Aggiunto
- Configurazione GitHub Actions per build automatici multi-piattaforma
- Sistema di aggiornamento automatico (Tauri Updater)

## [1.0.0] - 2026-06-08

### Aggiunto
- Gestione membri (creazione, rinnovo, eliminazione)
- Registrazione presenze con QR code
- Scanner QR code integrato
- Riepilogo mensile presenze
- Backup/Restore database
- Autenticazione admin con setup iniziale
- Interfaccia responsive (Tailwind CSS)
- Supporto multi-piattaforma (Windows, macOS, Linux)

### Tecnico
- Tauri 2.0 + React 19 + TanStack Start
- Database SQLite con Prisma ORM
- Autenticazione JWT + bcrypt
- TypeScript strict mode

[Unreleased]: https://github.com/Francy2009/The-Club/compare/v1.0.19...HEAD
[1.0.19]: https://github.com/Francy2009/The-Club/compare/v1.0.18...v1.0.19
[1.0.18]: https://github.com/Francy2009/The-Club/compare/v1.0.17...v1.0.18
[1.0.17]: https://github.com/Francy2009/The-Club/compare/v1.0.16...v1.0.17
[1.0.16]: https://github.com/Francy2009/The-Club/compare/v1.0.15...v1.0.16
[1.0.15]: https://github.com/Francy2009/The-Club/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/Francy2009/The-Club/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/Francy2009/The-Club/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/Francy2009/The-Club/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/Francy2009/The-Club/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/Francy2009/The-Club/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/Francy2009/The-Club/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/Francy2009/The-Club/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/Francy2009/The-Club/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/Francy2009/The-Club/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/Francy2009/The-Club/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/Francy2009/The-Club/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/Francy2009/The-Club/compare/v1.0.2...v1.0.3
[1.0.1]: https://github.com/Francy2009/The-Club/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.0
