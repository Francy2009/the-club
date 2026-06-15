# Gestore Pub

Applicazione open source per club privati: anagrafica soci, tessere QR, rinnovi, presenze, backup e report PDF.

## 🎯 Caratteristiche Principali

- **Gestione Soci**: Anagrafica completa con numero tessera, QR code, date iscrizione/scadenza
- **Presenze**: Check-in tramite QR code con storico giornaliero
- **Autenticazione Sicura**: Hash PBKDF2-SHA512 (310.000 iterazioni), sessioni HttpOnly/Secure/SameSite
- **Recupero Password**: Frase di recupero (hash separato) per reset senza email
- **Backup Sicuro**: JSON standard senza hash password/frase recupero + CSV per consultazione
- **Export Personalizzabile**: Scegli cartella di destinazione (File System Access API) o Download default
- **PWA Ready**: Installabile, offline-capable, manifest configurato
- **Desktop Tauri**: Build nativi Windows/macOS/Linux
- **Open Source**: Codice verificabile, zero telemetria, zero dipendenze esterne per dati sensibili

## 🔐 Primo Avvio - Configurazione Amministratore

Al **primo avvio assoluto** (database vuoto), l'applicazione:

1. Crea automaticamente un utente `admin` con password casuale sicura
2. Reindirizza alla pagina **`/setup`** per la configurazione obbligatoria
3. Richiede tre campi:
   - **Username** (min 3 caratteri, univoco)
   - **Password robusta** (min 8 caratteri, 1 maiuscola, 1 numero, 1 simbolo)
   - **Frase di recupero** (min 3 parole, 16 caratteri, confermata)

### Sicurezza della Configurazione Iniziale

- **Nessuna password hardcoded**: L'admin iniziale ha password casuale generata crypto-safe
- **Hash separati**: Password e frase di recupero usano salt diversi
- **Sessioni revocate**: Dopo il setup, tutte le sessioni precedenti vengono invalidate
- **Open source friendly**: Il codice sorgente non contiene segreti, solo logica di hash

### Requisiti Password
```
✓ Almeno 8 caratteri
✓ Almeno 1 maiuscola (A-Z)
✓ Almeno 1 numero (0-9)
✓ Almeno 1 simbolo (!@#$%^&*()_+-=[]{};':"\|,.<>/?)
```

### Requisiti Frase di Recupero
```
✓ Almeno 3 parole separate da spazi
✓ Almeno 16 caratteri totali
✓ Deve essere confermata identica
✓ Viene normalizzata (spazi multipli → singolo, trim)
```

> ⚠️ **Importante**: La frase di recupero è l'**unico modo** per recuperare l'accesso se dimentichi la password. Conservala in un password manager o luogo sicuro. Non è recuperabile dal codice.

## 🚀 Avvio In Sviluppo

```bash
# Installa dipendenze
npm install

# Avvia server sviluppo (Vite + TanStack Start)
npm run dev
```

Apri `http://localhost:3000`.

### Comandi Utili

```bash
# Setup database
npx prisma migrate deploy # Applica le migrazioni Prisma
npm run db:seed           # Crea l'admin iniziale di sviluppo

# Build produzione
npm run build             # Build client + server
npm run preview           # Anteprima build produzione

# Tauri Desktop
npm run build:tauri       # Build frontend per Tauri
cd src-tauri && cargo tauri dev
cd src-tauri && cargo tauri build
```

## 🖥️ Build Desktop Tauri

L'app include configurazione Tauri per build native:

```bash
# Sviluppo desktop (hot reload)
npm run build:tauri
cd src-tauri
cargo tauri dev

# Build installabili
npm run build:tauri
cd src-tauri
cargo tauri build
```

**Output**: `src-tauri/target/release/bundle/`
- Windows: `.msi`, `.exe`
- macOS: `.dmg`, `.app`
- Linux: `.AppImage`, `.deb`, `.rpm`

### Sicurezza Tauri
- CSP restrittiva abilitata nel bundle desktop
- Nessuna `allowlist` legacy Tauri v1 nella configurazione
- Gli export usano API browser quando disponibili, senza permessi Tauri aggiuntivi

## 📁 Export, PDF, Backup e Cartella Personalizzata

### Default: Cartella Download
Per impostazione predefinita, tutti i file generati vanno nella cartella **Download** del browser/sistema.

### Personalizzazione: Scegli Cartella (Impostazioni Admin)
Nelle **Impostazioni Admin** (`/admin/impostazioni`):
1. Clicca **"Scegli cartella export"**
2. Seleziona una cartella (richiede **File System Access API** - Chrome/Edge 86+, Firefox 111+, Safari 15.2+)
3. L'app richiede permesso di scrittura persistente
4. Tutti gli export futuri andranno lì

> 📝 **Nota**: Se l'API non è supportata, l'app torna automaticamente al download standard.

### Tipi di Export
| Tipo | Contenuto | Sensibilità |
|------|-----------|-------------|
| **Backup JSON standard** | Soci, ruoli, presenze e token QR; non include hash password/frase recupero | 🟡 Media - Dati personali |
| **CSV Soci** | Anagrafica (no hash, no QR token) | 🟡 Media - Dati personali |
| **CSV Presenze** | Storico check-in (no hash) | 🟡 Media - Dati personali |
| **PDF Tessere** | QR code + dati socio | 🟡 Media |
| **PDF Report** | Report presenze, scadenze | 🟡 Media |

### Sicurezza Backup
- Il backup JSON standard **non contiene hash password** né **hash frase recupero**
- Contiene comunque **token QR** e dati personali dei soci
- **Conserva backup su supporti protetti** (VeraCrypt, BitLocker, FileVault, LUKS)
- Non condividere backup in chat, email non cifrate, cloud non protetto

## 🔑 Recupero Accesso Amministratore

### Metodo 1: Frase di Recupero (Consigliato)
1. Vai a `/login`
2. Clicca **"Recupera password"**
3. Inserisci: username + frase di recupero + nuova password
4. Accesso ripristinato, sessioni precedenti revocate

### Metodo 2: Reset da Terminale (Emergenza)
Sulla macchina che ospita il database Prisma:

```bash
# Password generata casualmente
npm run db:reset-admin

# Password personalizzata
ADMIN_RESET_PASSWORD="TuaPassSicura1!" npm run db:reset-admin
```

Dopo il reset: l'app forza **nuovamente** la configurazione di password e frase di recupero (`/setup`).

## 🧪 Test e Qualità

```bash
# Test automatici
npm test

# Build completa
npm run build

# Build Tauri
npm run build:tauri
```

> Nota: `npx tsc --noEmit` oggi include anche la cartella di esempio `start-basic`, che non e allineata al route tree principale.

## 📂 Struttura Progetto

```text
gestore-pub/
├── src/
│   ├── components/       # Componenti UI riutilizzabili (Header, Footer, ThemeToggle)
│   ├── lib/              # Core logic: auth, db, api, export-preferences
│   │   ├── auth.server.ts      # Hash, sessioni, cookie sicuri
│   │   ├── db.ts               # Client Prisma singleton
│   │   ├── api.functions.ts    # Server functions (TanStack Start)
│   │   ├── export-preferences.ts # File System Access API + IndexedDB
│   │   └── api.ts              # Client-side API wrappers
│   ├── routes/           # Pagine (file-based routing TanStack Router)
│   │   ├── __root.tsx          # Layout radice, auth context, theme
│   │   ├── setup.tsx           # Configurazione iniziale admin
│   │   ├── login.tsx           # Login + recupero password
│   │   ├── index.tsx           # Dashboard utente
│   │   ├── profile.tsx         # Profilo socio
│   │   ├── admin/              # Pannello amministrazione
│   │   │   ├── index.tsx       # Gestione soci
│   │   │   ├── presenze.tsx    # Check-in QR
│   │   │   ├── scanner.tsx     # Scanner QR camera
│   │   │   ├── riepilogo.tsx   # Report presenze
│   │   │   ├── create.tsx      # Crea socio + PDF tessera
│   │   │   ├── attendance.tsx  # Storico presenze
│   │   │   └── impostazioni.tsx # Config admin, export, backup
│   ├── router.tsx        # Router TanStack + route tree
│   ├── routeTree.gen.ts  # Generato automaticamente
│   └── styles.css        # Tailwind + custom CSS
├── prisma/
│   ├── schema.prisma     # Modelli DB (Member, Attendance, Session, UserRole)
│   ├── seed.ts           # Seed sviluppo
│   ├── reset-admin-password.ts # Script reset admin
│   └── migrations/       # Migrazioni SQL versionate
├── src-tauri/            # Configurazione Tauri (Rust)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/main.rs
├── public/               # Asset statici (manifest, sw.js, icons)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md
├── PRIVACY.md
├── CHANGELOG.md
└── LICENSE
```

## 🛡️ Architettura Sicurezza

### Autenticazione
- **PBKDF2-SHA512**, 310.000 iterazioni, salt 16 byte, key 64 byte
- **Sessioni**: Token 32 byte base64url, hash SHA-256 in DB, cookie HttpOnly/Secure/SameSite=Strict
- **Rate limiting**: Login (8 tentativi/15min → lock 15min), Recovery (5 tentativi/15min → lock 30min)
- **Timing-safe comparison**: `crypto.timingSafeEqual` per hash

### Frase di Recupero
- Hash **separato** dalla password (stesso algoritmo, salt diverso)
- Non derivata dalla password, indipendente
- Verificata in constant-time

### Protezione Dati
- **Zero telemetria**: Nessun analytics, tracking, beacon
- **Zero CDN esterni**: Font, CSS, JS serviti localmente
- **CSP Ready**: Headers configurabili per produzione
- **PWA Offline**: Service worker per asset statici

## 📋 Checklist Deploy Produzione

- [ ] `NODE_ENV=production` impostato
- [ ] Database SQLite su volume persistente (non efemero)
- [ ] HTTPS obbligatorio (cookie `secure: true`)
- [ ] Reverse proxy (Nginx/Caddy) con headers sicurezza
- [ ] Backup automatici database + file export
- [ ] Monitoraggio spazio disco (backup JSON crescono)
- [ ] CSP headers: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- [ ] HSTS, X-Frame-Options, Referrer-Policy configurati

## 🤝 Contribuire

1. Fork repository
2. Crea branch feature (`git checkout -b feature/nome`)
3. Commit cambiamenti (`git commit -m 'feat: descrizione'`)
4. Push branch (`git push origin feature/nome`)
5. Apri Pull Request

### Convenzioni Commit
- `feat:` nuova funzionalità
- `fix:` correzione bug
- `docs:` documentazione
- `refactor:` ristrutturazione codice
- `security:` miglioramenti sicurezza
- `chore:` manutenzione

## 📄 Licenza

MIT License - Vedi `LICENSE` per dettagli.

## 📞 Supporto

- **Issues**: GitHub Issues per bug/feature request
- **Security**: Per vulnerabilità, apri issue privato o email maintainer
- **Documentazione**: Questo README + `PRIVACY.md` + codice sorgente commentato

---

**Gestore Pub** - Sviluppato per club privati che vogliono controllo totale sui propri dati.

## Note Di Sicurezza

- L'app e open source: non fare affidamento su segreti nel codice.
- Password e frase di recupero devono essere forti e uniche.
- Chi accede al dispositivo admin o ai backup puo tentare attacchi offline sugli hash.
- I token QR identificano le tessere: non pubblicare backup o screenshot dei QR.
- Aggiorna dipendenze e sistema operativo con regolarita.
- Prima di pubblicare una release, esegui build e test su una copia del database.

## Privacy

Vedi [PRIVACY.md](PRIVACY.md).

## Licenza

MIT, vedi [LICENSE](LICENSE).
