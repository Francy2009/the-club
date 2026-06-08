# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

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

[Unreleased]: https://github.com/FrancescoDellOrto/Gestore-pub/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/FrancescoDellOrto/Gestore-pub/releases/tag/v1.0.0