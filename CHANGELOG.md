# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [1.0.3] - 2026-06-25

### Fix
- **Persistenza dati sugli aggiornamenti**: la cartella dati dell'app dipende dall'identifier; la rinomina del progetto da "Gestore Pub" (`com.gestore.pub`) a "The Club" (`com.the.club`) spostava la cartella dati, rendendo invisibile il database locale scritto dalla build precedente. Al primo avvio della nuova build il DB risultava assente e l'app creava un admin vuoto: sembrava un reset. Ora, se il file del DB nella cartella attuale non esiste, l'app lo recupera una-tantum dalla cartella della build precedente e lo migra nel percorso attuale. Corretto su tutte le piattaforme (`.deb`, `.rpm`, AppImage, Windows, macOS).
- **Pacchetto `.deb` su Linux**: il `postrm` cancellava la cartella dati utente anche su `remove` (e non solo su `purge`). Poiché molti flussi di aggiornamento su Ubuntu/GNOME Software fanno "rimuovi vecchia + installa nuova" passando per `remove`, l'aggiornamento poteva azzerare i dati. Ora la cartella dati viene rimossa solo su `purge`, in conformità alla policy Debian; la rimozione esplicita resta disponibile in-app (Impostazioni → Rimuovi dati locali).

## [1.0.2] - 2026-06-25

### Sicurezza
- Hardening del layer desktop Tauri: aggiunte capability esplicite con permessi minimi e disabilitata l'esposizione globale dell'API Tauri (`withGlobalTauri: false`). Questo riduce la superficie d'attacco in caso di compromissione del frontend, limitando i comandi Rust invocabili solo a quelli strettamente necessari.

## [1.0.1] - 2026-06-22

### Sicurezza
- Miglioramenti generali alla sicurezza dell'autenticazione

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

[Unreleased]: https://github.com/Francy2009/The-Club/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.2
[1.0.1]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.1
[1.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.0
