# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

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

[Unreleased]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.10...HEAD
[1.0.10]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.2...v1.0.3
[1.0.1]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Francy2009/Gestore-pub/releases/tag/v1.0.0
