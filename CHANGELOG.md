# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [1.0.1] - 2026-06-22

### Aggiunto
- Protezione brute force anche sulla versione desktop: dopo troppi tentativi di login o recupero password sbagliati, l'accesso viene bloccato temporaneamente (15 min per il login, 30 min per il recupero). Uguale a quello che c'era già sulla versione server.

### Sicurezza
- Rate limiting in memoria su login (8 tentativi / 15 min) e recupero password (5 tentativi / 15 min) nella versione desktop

## [1.0.0] - 2026-06-21

Prima release pubblica.

### Aggiunto
- Gestione soci: creazione, rinnovo, eliminazione
- Tessere QR code permanenti (il QR identifica la persona, non scade al rinnovo)
- Scanner QR per registrazione presenze con selezione fotocamera
- Ricerca manuale socio per nome o numero tessera
- Riepilogo mensile con selettore mese (fino a 12 mesi indietro)
- Export PDF tessere soci, scadenze e riepilogo eventi
- Backup e ripristino database (JSON)
- Export CSV soci e presenze
- Autenticazione admin con setup iniziale
- Recupero password tramite domanda personale
- Avviso automatico aggiornamenti all'apertura dell'app
- Pulsante "Rimuovi dati locali" nelle impostazioni
- Supporto multi-piattaforma: Windows, macOS, Linux

### Sicurezza
- Password con hash PBKDF2-SHA512 (310.000 iterazioni, sale 16 byte)
- Sessioni con token hashati, cookie HttpOnly + Secure + SameSite=strict
- Rate limiting persistente su login e recupero password
- Protezione CSRF globale
- Content Security Policy nel bundle Tauri
- Backup standard senza hash password o hash risposta di recupero
- Protezione contro CSV formula injection
- Nessuna telemetria o tracking

### Tecnico
- Tauri 2 + React 19 + TanStack Start
- Database locale (SQLite via Prisma in sviluppo, file JSON in desktop)
- Autenticazione con PBKDF2-SHA512 + token di sessione
- TypeScript strict mode
- Tailwind CSS

[Unreleased]: https://github.com/Francy2009/The-Club/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.1
[1.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.0
