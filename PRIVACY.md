# Privacy Policy - Gestore Pub

**Ultimo aggiornamento**: 14 giugno 2026  
**Versione**: 2.0  
**Applicabile a**: Tutte le versioni ≥ 1.0.0

---

## 1. Titolare del Trattamento e Ambito di Applicazione

**Gestore Pub** è un'applicazione **open source, self-hosted, locale** per la gestione di club privati e associazioni.

| Aspetto | Dettaglio |
|---------|-----------|
| **Titolare** | L'amministratore del club che installa, configura e gestisce l'applicazione |
| **Ruolo sviluppatore** | Fornisce solo il codice sorgente; **non ha accesso** a dati di installazioni terze |
| **Licenza** | MIT - Codice verificabile, modificabile, ridistribuibile |
| **Architettura** | Zero telemetria, zero tracking, zero dipendenze cloud obbligatorie |

> ⚖️ **Nota legale**: Questa policy descrive il **comportamento tecnico del software** come distribuito. L'amministratore del club è **titolare autonomo** del trattamento ai sensi GDPR/legge privacy applicabile e deve integrare questa policy con informative specifiche per i propri soci.

---

## 2. Categorie di Dati Personali Trattati

L'applicazione tratta **esclusivamente** i dati strettamente necessari alla gestione del club:

| Categoria | Campi | Base Giuridica Tipica* |
|-----------|-------|------------------------|
| **Anagrafica Soci** | Nome, Cognome, Numero tessera (opzionale), Username univoco | Esecuzione contratto/statuto associativo |
| **Temporali** | Data iscrizione, Data scadenza tessera (opzionale) | Esecuzione contratto/statuto associativo |
| **Presenze** | Timestamp check-in, Giorno check-in, Flag socio eliminato | Legittimo interesse / Esecuzione contratto |
| **Autenticazione** | Username, domanda recupero, hash password (PBKDF2-SHA512), hash risposta recupero (PBKDF2-SHA512) | Sicurezza sistemi / Obbligo legale protezione dati |
| **Token QR** | Token base64url 32 byte (univoco per tessera) | Esecuzione contratto / Legittimo interesse |
| **Export/Backup** | JSON completo (tutto sopra), CSV (solo anagrafica/presenze, no hash) | Obbligo conservazione / Legittimo interesse admin |

\* *La base giuridica concreta spetta al titolare (amministratore club) valutare per la propria giurisdizione.*

### Dati **NON** Trattati
- ❌ Dati sanitari / sensibili (art. 9 GDPR)
- ❌ Documenti identità / biometrici
- ❌ Dati pagamento / bancari
- ❌ Geolocalizzazione / GPS
- ❌ Contatti rubrica / calendario
- ❌ Analytics / behavioral tracking
- ❌ Dati minori (salvo gestione familiare club, a cura admin)

---

## 3. Architettura di Sicurezza - Dettaglio Tecnico

### 3.1 Hashing Credenziali
```
Algoritmo:     PBKDF2-HMAC-SHA512
Iterazioni:    310.000 (configurabile via costante PASSWORD_HASH_ITERATIONS)
Salt:          16 byte casuali (crypto.randomBytes) per ogni hash
Key length:    64 byte (512 bit)
Formato:       pbkdf2_sha512$iterations$salt$hash (hex)
```
- **Password** e **risposta di recupero** usano **salt indipendenti**
- Confronto in **constant-time** (`crypto.timingSafeEqual`)
- Supporto legacy per migrazione da vecchi hash (1.000 iterazioni)

### 3.2 Gestione Sessioni
```
Token:         32 byte base64url (crypto.randomBytes)
Storage DB:    SHA-256 hash del token (non token in chiaro)
Cookie:        HttpOnly, Secure (solo HTTPS), SameSite=Strict, Path=/
Durata:        7 giorni (rolling)
Revoca:        Immediata su logout, cambio password, reset admin, scadenza
```

### 3.3 Rate Limiting (Brute Force Protection)
| Endpoint | Finestra | Max Tentativi | Lockout |
|----------|----------|---------------|---------|
| Login | 15 min | 8 | 15 min |
| Recupero Password | 15 min | 5 | 30 min |

- Basato su **username normalizzato** (lowercase)
- Persistente su SQLite tramite tabella `RateLimitAttempt`
- Per produzione multi-istanza: usare uno store condiviso esterno

### 3.4 Frase di Recupero
- **Indipendente** dalla password (hash separato, salt separato)
- Requisiti: da 1 a 4 parole, 2-80 caratteri, conferma identica
- Normalizzazione: `trim()` + `replace(/\s+/g, ' ')` + minuscole
- Non derivabile da password, non usabile come password

### 3.5 Token QR Tessere
- Generazione: `crypto.randomBytes(32).toString('base64url')` (256 bit entropy)
- Univoco per socio (`@unique` in Prisma)
- Chiunque possieda token può registrare presenza → **trattare come credenziale**

---

## 4. Luogo e Modalità di Conservazione

### 4.1 Database Primario
| Ambiente | Storage | Controllo Accesso |
|----------|---------|-------------------|
| Sviluppo/Server | File SQLite (`prisma/dev.db` o `prod.db`) | Permessi FS host |
| Desktop Tauri | File JSON locale `desktop-db.json` in app data dir (`%APPDATA%`/`~/Library`/`~/.local/share`) | Permessi filesystem utente + comandi Tauri limitati |
| Docker/Container | Volume persistente mappato | Orchestratore container |

> 🔒 **Responsabilità admin**: Proteggere file database e backup (filesystem cifrato, account OS protetto, backup cifrati). Nelle versioni desktop recenti l'eventuale vecchio database in `localStorage` viene migrato automaticamente al file locale dell'app.

### 4.2 File Esportati (Export/Backup)
| Tipo | Destinazione Default | Destinazione Personalizzabile | Contenuto Sensibile |
|------|---------------------|------------------------------|---------------------|
| Backup JSON | `~/Downloads/gestore-pub-backup-*.json` | ✅ Cartella scelta via File System Access API | **TUTTO** (hash, QR token, anagrafica) |
| CSV Soci | `~/Downloads/gestore-pub-soci-*.csv` | ✅ Stessa cartella backup | Anagrafica (no hash, no QR) |
| CSV Presenze | `~/Downloads/gestore-pub-presenze-*.csv` | ✅ Stessa cartella backup | Storico check-in (no hash) |
| PDF Tessere | `~/Downloads/tessera-*.pdf` | ✅ Stessa cartella backup | QR code + dati socio |
| PDF Report | `~/Downloads/report-*.pdf` | ✅ Stessa cartella backup | Aggregati presenze |

### 4.3 Preferenze Export (Client-side)
- Salvate in **localStorage** (`gestore-pub:export-preference`)
- Handle directory salvato in **IndexedDB** (`gestore-pub-export-settings`)
- **Solo browser dell'admin**, non sincronizzate, non inviate al server

---

## 5. Flusso Dati e Comunicazioni di Rete

### 5.1 Richieste di Rete dell'Applicazione
| Operazione | Destinazione | Dati Inviati | Frequenza |
|------------|--------------|--------------|-----------|
| Login/Setup/Recovery | **Solo server locale** (stesso origin) | Credenziali (HTTPS) | Su azione utente |
| API CRUD Soci/Presenze | **Solo server locale** | Dati anagrafici/presenze | Su azione admin |
| Export/Backup | **Solo server locale** → **File system client** | Dati completi DB | Su azione admin |
| Ripristino Backup | **File system client** → **Solo server locale** | Backup JSON | Su azione admin |
| Controllo aggiornamenti | **Nessuno** (disabilitato) | - | Mai |
| Analytics/Telemetria | **Nessuno** | - | Mai |
| Font/CDN esterni | **Nessuno** (self-hosted) | - | Mai |

### 5.2 Service Worker (PWA)
- Cache solo **asset statici** (HTML, CSS, JS, manifest, icone)
- **Nessuna cache** di risposte API / dati utente
- `sw.js` incluso in `public/`, registrato solo in produzione

### 5.3 Headers Sicurezza Consigliati (Produzione)
```nginx
# Esempio Nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

---

## 6. Finalità del Trattamento (Per Categoria)

| Finalità | Dati Usati | Base Giuridica Tipica | Conservazione |
|----------|------------|----------------------|---------------|
| Identificazione socio | Nome, Cognome, Numero tessera, Username | Esecuzione contratto/statuto | Fino a revoca iscrizione + obblighi legge |
| Autenticazione accesso | Username, Hash password, Hash recovery | Sicurezza sistemi / Obbligo protezione dati | Fino a revoca account |
| Recupero credenziali | Username, domanda recupero, hash risposta recupero | Sicurezza / Legittimo interesse | Fino a revoca account |
| Registrazione presenze | Token QR, Timestamp, Giorno | Esecuzione contratto / Legittimo interesse | Definita da statuto/regolamento club |
| Generazione tessere QR | Token QR, Dati anagrafici | Esecuzione contratto | Durata validità tessera |
| Report/Statistiche | Presenze aggregate, Anagrafica | Legittimo interesse admin / Obblighi associativi | Definita da admin |
| Backup/Disaster Recovery | **Tutto il database** | Obbligo conservazione / Legittimo interesse | Definita da admin (min. annuale consigliato) |

---

## 7. Periodo di Conservazione e Cancellazione

### 7.1 Policy Applicativa (Software)
- **Nessuna cancellazione automatica** implementata nel codice
- L'app fornisce **strumenti** per:
  - Modificare dati socio
  - Eliminare socio (cascade: presenze → `member_was_deleted=true`, dati anonimizzati)
  - Eliminare singole presenze
  - Eliminare file export/backup locali (manuale da FS)

### 7.2 Responsabilità Amministratore
Il titolare (admin club) deve definire e applicare:
- Periodo conservazione soci attivi/inattivi
- Periodo conservazione storico presenze
- Policy cancellazione backup (es. rotazione 12 mesi, 3 copie)
- Procedure diritto all'oblio / rettifica su richiesta socio

> 📋 **Suggerimento**: Documentare in regolamento interno club: "Dati soci conservati per X anni da cessazione rapporto; presenze per Y anni; backup rotati mensilmente con retention 13 mesi."

---

## 8. Diritti degli Interessati (Soci) e Strumenti Applicativi

| Diritto GDPR | Strumento in App | Note |
|--------------|------------------|------|
| **Accesso (Art. 15)** | Admin: visualizza scheda socio; Socio: area profilo (`/profile`) | Export CSV/JSON su richiesta |
| **Rettifica (Art. 16)** | Admin: modifica socio (`/admin` → edit) | Logico: modifica diretta DB |
| **Cancellazione (Art. 17)** | Admin: elimina socio (anonymizza presenze) | Valutare obblighi conservazione legali |
| **Limitazione (Art. 18)** | Non automatizzato: admin segna socio "inattivo" | Impostare `expiry_date` passata |
| **Portabilità (Art. 20)** | Export CSV soci + presenze | Formato strutturato, leggibile macchina |
| **Opposizione (Art. 21)** | Non applicabile (no marketing/profilazione) | - |
| **Reclamo Autorità** | Contatti admin in app / repository | Admin deve fornire canale formale |

> ⚠️ **Attenzione**: L'app **non invia notifiche automatiche** ai soci. L'admin deve gestire comunicazioni (email, posta, bacheca) per esercizio diritti.

---

## 9. Trasferimenti e Destinatari

### 9.1 Destinatari Interni
- **Solo amministratori club** (ruolo `admin` in DB)
- Accesso loggato, tracciabile via sessioni

### 9.2 Trasferimenti Esterni
| Scenario | Responsabilità | Misure |
|----------|----------------|--------|
| Backup su cloud (Drive, Dropbox, S3, ecc.) | **Admin** | Cifratura client-side (VeraCrypt, Cryptomator, Restic, Borg) prima upload |
| Invio CSV/PDF via email/chat | **Admin** | Solo canali cifrati (PGP, Signal, email TLS) |
| Migrazione server | **Admin** | Dump SQLite + file export su supporto cifrato |
| Sviluppatore/Repository | **Nessuno** | Codice open source, **zero accesso** a dati installazioni |

### 9.3 Sub-processori (Terze Parti)
**Nessuno integrato nel software**. Eventuali servizi usati dall'admin (hosting, VPS, email, cloud) sono **scelti e contrattualizzati dall'admin**.

---

## 10. Misure di Sicurezza Tecniche e Organizzative (TOMs)

### 10.1 Implementate nel Codice
- ✅ Hashing credenziali PBKDF2-SHA512 (310k iterazioni)
- ✅ Salt univoci per password e risposta recupero
- ✅ Confronto timing-safe
- ✅ Sessioni HttpOnly, Secure, SameSite=Strict
- ✅ Rate limiting login/recovery
- ✅ Revoca sessioni su eventi critici
- ✅ Token QR ad alta entropia (256 bit)
- ✅ Validazione input server-side (Zod-like manuale)
- ✅ Prepared statements (Prisma ORM) → SQL injection prevention
- ✅ CSP-ready, no inline scripts critici
- ✅ PWA offline-first (asset statici only)

### 10.2 A Carico Amministratore (Deploy)
- ☐ HTTPS obbligatorio (TLS 1.2+)
- ☐ Database su volume cifrato (LUKS, BitLocker, FileVault, VeraCrypt)
- ☐ Backup database cifrati (restic, borg, duplicati + password forte)
- ☐ Accesso server: SSH key-only, fail2ban, firewall
- ☐ Reverse proxy con headers sicurezza (vedi §5.3)
- ☐ Monitoraggio integrità file (AIDE, Tripwire)
- ☐ Log accessi server (auditd, journalctl)
- ☐ Piano incident response / data breach notification

---

## 11. Data Breach - Procedure

### 11.1 Rilevamento
- Accesso anomalo DB (query inaspettate, orari insoliti)
- File backup/esportati spariti/duplicati su FS
- Log server: login falliti massivi, privilege escalation
- Segnalazione socio (credenziali compromesse)

### 11.2 Contenimento (Admin)
1. **Revoca sessioni**: Cambio password admin → revoca tutte sessioni
2. **Isolamento**: Firewall/stop container se compromissione server
3. **Analisi**: Log DB (Prisma non logga query default → abilitare `prisma.logging` se necessario)
4. **Notifica**: Se dati personali esfiltrati → 72h Autorità Garante (GDPR Art. 33)

### 11.3 Ripristino
- Ripristino da backup **cifrato, verificato, antecedente breach**
- Rotazione **tutte** credenziali (admin + soci se hash esfiltrati)
- Nuovi token QR per tutti i soci (rigenerazione batch)

---

## 12. Minori e Categorie Particolari

- L'app **non prevede** trattamento dati minori < 16 anni
- Se club ammette soci minorenni: **responsabilità admin** per consenso genitori/tutori
- **Nessun campo** per dati sanitari, biometrici, giudiziari, orientamento sessuale, religione, etnia

---

## 13. Cookie e Tecnologie Simili

| Cookie | Scopo | Durata | Tipo |
|--------|-------|--------|------|
| `club_member_session` | Autenticazione utente | 7 giorni (rolling) | **Tecnico strettamente necessario** |
| `theme` (localStorage) | Preferenza tema UI | Persistente | Preferenza utente |
| `gestore-pub:export-preference` (localStorage) | Cartella export scelta | Persistente | Preferenza admin |
| IndexedDB `gestore-pub-export-settings` | Handle directory FS API | Persistente | Funzionalità export |

**Nessun cookie**: analytics, marketing, tracking, terze parti, fingerprinting.

---

## 14. Aggiornamenti di Questa Policy

| Versione | Data | Cambiamenti Principali |
|----------|------|------------------------|
| 2.0 | 14/06/2026 | Ristrutturazione completa: dettaglio tecnico, TOMs, breach, minori, cookie, tabelle |
| 1.0 | Iniziale | Versione base |

- Controllare `CHANGELOG.md` per modifiche codice che impattano privacy
- Admin deve aggiornare propria informativa soci se policy app cambia

---

## 15. Contatti e Responsabilità

### Per Installazione Specifica (Dati Soci)
> **Contattare l'Amministratore del Club** che gestisce l'installazione.
> L'app non ha meccanismo contatti centralizzato.

### Per Problemi Tecnici Software (Codice, Vulnerabilità)
> **Repository GitHub**: Apri Issue (pubblica) o Security Advisory (privata per vulnerabilità)
> **Maintainer**: Vedi `package.json` → `author` / repository URL

### Per Esercizio Diritti (Soci)
> Rivolgersi all'**Amministratore del Club** (titolare del trattamento).
> L'app fornisce strumenti; l'admin gestisce processi e tempistiche.

---

## 16. Allegato: Checklist Conformità Admin (Non Esaustiva)

```
[ ] Informativa soci integrata con questa policy + specifiche club
[ ] Registro trattamenti (Art. 30 GDPR) aggiornato
[ ] DPIA se trattamento su larga scala / rischio elevato
[ ] Nomina responsabili esterni (hosting, cloud backup) con DPA
[ ] Procedure diritti interessati documentate e testate
[ ] Piano data breach (rilevamento, contenimento, notifica 72h)
[ ] Backup cifrati, testati, off-site, retention definita
[ ] HTTPS + headers sicurezza + HSTS preload
[ ] Database su storage cifrato
[ ] Accessi server: MFA, key-only, audit log
[ ] Formazione admin su gestione sicura backup/export
[ ] Policy conservazione/cancellazione documentata
[ ] Verifica periodica (annuale) misure sicurezza
```

---

**Documento generato per Gestore Pub v2.0+**  
*Questa policy descrive il software come distribuito. L'amministratore è responsabile di adattarla alla propria realtà giuridica e operativa.*
