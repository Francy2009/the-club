# Privacy - The Club

**Ultimo aggiornamento**: 21 giugno 2026
**Versione**: 3.0
**Applicabile a**: Tutte le versioni ≥ 1.0.0

---

> ⚠️ **Questo documento descrive solo il comportamento tecnico del software.**
> Non è un'informativa privacy pronta all'uso, né consulenza legale.
> L'amministratore che installa e usa l'app è il **titolare del trattamento** dei dati dei propri soci ed è responsabile di redigere la propria informativa e di rispettare la normativa privacy applicabile nella propria giurisdizione. Per la conformità GDPR o altre normative, rivolgersi a un consulente qualificato.

---

## 1. Architettura

**The Club** è un'applicazione **open source, locale, self-hosted**.

| Aspetto | Dettaglio |
|---------|-----------|
| **Architettura** | Zero telemetria, zero tracking, zero cloud obbligatorio |
| **Dati** | Salvati sul dispositivo dell'amministratore che installa l'app |
| **Sviluppatore** | Fornisce solo il codice sorgente; **non ha accesso** a dati di installazioni terze |
| **Licenza** | MIT — codice verificabile, modificabile, ridistribuibile |

---

## 2. Dati trattati dal software

L'app gestisce i dati strettamente necessari al funzionamento del club:

| Categoria | Campi |
|-----------|-------|
| **Anagrafica soci** | Nome, Cognome, Numero tessera (opzionale), Username univoco |
| **Date** | Data iscrizione, Data scadenza tessera (opzionale) |
| **Presenze** | Timestamp check-in, Giorno check-in, Flag socio eliminato |
| **Autenticazione** | Username, hash password (PBKDF2-SHA512), hash risposta recupero (PBKDF2-SHA512), dati recupero protetti |
| **Token QR** | Token base64url 32 byte, univoco per tessera |
| **Export/Backup** | JSON con anagrafica, presenze, ruoli, dati recupero non segreti e token QR; CSV senza hash |

### Dati **non** trattati dal software

Il software non raccoglie né gestisce:

- Dati sanitari / sensibili
- Documenti di identità / dati biometrici
- Dati di pagamento / bancari
- Geolocalizzazione / GPS
- Contatti della rubrica / calendario
- Analytics / tracciamento comportamentale

---

## 3. Dove vengono salvati i dati

### 3.1 Database primario

| Ambiente | Storage |
|----------|---------|
| Sviluppo/Server | File SQLite (`prisma/dev.db` o `prod.db`) |
| Desktop (Tauri) | File JSON locale `desktop-db.json` nella cartella dati dell'app: `%APPDATA%` (Windows), `~/Library/Application Support` (macOS), `~/.local/share` (Linux) |
| Docker/Container | Volume persistente mappato |

Nelle versioni desktop recenti l'eventuale vecchio database in `localStorage` viene migrato automaticamente al file locale dell'app.

### 3.2 File esportati

| Tipo | Destinazione default | Contenuto |
|------|---------------------|-----------|
| Backup JSON | `~/Downloads/the-club-backup-*.json` | Anagrafica, storico, ruoli, dati recupero non segreti, token QR. **Nessun hash password/recupero** |
| CSV Soci | `~/Downloads/the-club-soci-*.csv` | Anagrafica (no hash, no QR) |
| CSV Presenze | `~/Downloads/the-club-presenze-*.csv` | Storico check-in (no hash) |
| PDF Tessere | `~/Downloads/tessera-*.pdf` | QR code + dati socio |
| PDF Report | `~/Downloads/report-*.pdf` | Aggregati presenze |

La cartella di destinazione è personalizzabile dall'admin tramite File System Access API.

### 3.3 Preferenze export (client-side)

- Salvate in **localStorage** (`the-club:export-preference`)
- Handle directory salvato in **IndexedDB** (`the-club-export-settings`)
- Solo nel browser dell'admin, non sincronizzate, non inviate al server

---

## 4. Comunicazioni di rete

| Operazione | Destinazione | Dati inviati | Frequenza |
|------------|--------------|--------------|-----------|
| Login/Setup/Recovery | Solo server locale (stesso origin) | Credenziali | Su azione utente |
| API soci/presenze | Solo server locale | Dati anagrafici/presenze | Su azione admin |
| Export/Backup | Solo server locale → filesystem client | Backup senza hash password | Su azione admin |
| Controllo aggiornamenti | `api.github.com` (GitHub Releases) | Solo tag versione più recente, **nessun dato utente** | All'apertura dell'app e ogni ora |
| Analytics/Telemetria | Nessuno | — | Mai |
| Font/CDN esterni | Nessuno (self-hosted) | — | Mai |

### Service Worker (PWA)

- Cache solo di asset statici (HTML, CSS, JS, manifest, icone)
- Nessuna cache di risposte API o dati utente
- `sw.js` in `public/`, registrato solo in produzione

---

## 5. Misure di sicurezza tecniche (implementate nel codice)

### 5.1 Hashing credenziali

```
Algoritmo:     PBKDF2-HMAC-SHA512
Iterazioni:    310.000 (configurabile via costante PASSWORD_HASH_ITERATIONS)
Salt:          16 byte casuali (crypto.randomBytes) per ogni hash
Key length:    64 byte (512 bit)
Formato:       pbkdf2_sha512$iterations$salt$hash (hex)
```

- Password e risposta di recupero usano **salt indipendenti**
- Confronto in **constant-time** (`crypto.timingSafeEqual`)
- Supporto legacy per migrazione da vecchi hash (1.000 iterazioni)

### 5.2 Gestione sessioni

```
Token:         32 byte base64url (crypto.randomBytes)
Storage DB:    SHA-256 hash del token (non token in chiaro)
Cookie:        HttpOnly, Secure (solo HTTPS), SameSite=Strict, Path=/
Durata:        7 giorni (rolling)
Revoca:        Immediata su logout, cambio password, reset admin, scadenza
```

### 5.3 Rate limiting (brute force)

| Endpoint | Finestra | Max tentativi | Lockout |
|----------|----------|---------------|---------|
| Login | 15 min | 8 | 15 min |
| Recupero password | 15 min | 5 | 30 min |

Basato su username normalizzato (lowercase), persistente su SQLite.

### 5.4 Frase di recupero

- Indipendente dalla password (hash separato, salt separato)
- Requisiti: da 1 a 4 parole, 2-80 caratteri, conferma identica
- Normalizzazione: `trim()` + `replace(/\s+/g, ' ')` + minuscole

### 5.5 Token QR tessere

- Generazione: `crypto.randomBytes(32).toString('base64url')` (256 bit entropy)
- Univoco per socio (`@unique` in Prisma)
- Chiunque possieda il token può registrare una presenza → va trattato come credenziale

### 5.6 Altre misure

- Content Security Policy nel bundle Tauri
- Prepared statements (Prisma ORM) → prevenzione SQL injection
- Validazione input server-side
- Protezione contro CSV formula injection
- Nessuna telemetria o tracking

---

## 6. Cookie e tecnologie simili

| Nome | Scopo | Durata | Tipo |
|------|-------|--------|------|
| `club_member_session` | Autenticazione utente | 7 giorni (rolling) | Tecnico strettamente necessario |
| `the-club:export-preference` (localStorage) | Cartella export scelta | Persistente | Preferenza admin |
| IndexedDB `the-club-export-settings` | Handle directory FS API | Persistente | Funzionalità export |

Nessun cookie di analytics, marketing, tracking o terze parti.

---

## 7. Cancellazione dei dati

Il software fornisce strumenti per:

- Modificare i dati di un socio
- Eliminare un socio (le presenze vengono anonimizzate con `member_was_deleted=true`)
- Eliminare singole presenze
- Eliminare manualmente i file export/backup dal filesystem
- Cancellare tutti i dati locali dal pannello impostazioni dell'app

Il software **non** implementa cancellazione automatica o retention policy: la gestione dei periodi di conservazione spetta all'amministratore.

---

## 8. Aggiornamenti di questo documento

| Versione | Data | Cambiamenti |
|----------|------|-------------|
| 3.0 | 21/06/2026 | Riscritta: solo comportamento tecnico, nessun consiglio legale |
| 2.0 | 14/06/2026 | Ristrutturazione completa |
| 1.0 | Iniziale | Versione base |

---

**Documento tecnico per The Club v1.0.0+.**
*Questo documento non sostituisce l'informativa privacy dell'amministratore del club, che è responsabile del trattamento dei dati dei propri soci.*