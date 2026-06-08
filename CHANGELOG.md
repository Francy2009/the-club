# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

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

[Unreleased]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.2...v1.0.3
[1.0.1]: https://github.com/Francy2009/Gestore-pub/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Francy2009/Gestore-pub/releases/tag/v1.0.0
