# Security Audit Report - Gestore Pub

**Data Analisi:** 2026-06-19
**Versione Applicazione:** 1.0.18
**Tipologia:** Applicazione locale per gestione soci e presenze (Club Privato)  
**Stack Tecnologico:** React 19, TanStack Start, Prisma ORM, SQLite, Tauri 2 (Desktop)  
**Ambiente:** Single-page application con backend integrato (Server Functions), deployabile come web app o app desktop Tauri

**Stato mitigazioni (2026-06-19):** le vulnerabilità principali sono state indirizzate nel codice:
- rate limiting login/recupero persistente su SQLite tramite `RateLimitAttempt`;
- protezione CSRF globale per richieste non-GET con controllo `Origin`/`Sec-Fetch-Site`;
- backup standard senza hash password/frase recupero; l'esportazione completa con credenziali è stata rimossa dalle API pubbliche;
- percorsi login/recupero uniformati contro username enumeration;
- CSP Tauri abilitata;
- database desktop Tauri spostato da `localStorage` WebView a file locale `desktop-db.json` nella cartella dati dell'app, con migrazione automatica dal vecchio storage;
- DevTools limitati alla modalità `serve`;
- rotazione sessioni su login, cambio password e cambio frase recupero;
- build desktop self-contained senza import runtime di font remoti;
- ultimo controllo locale: `npm audit --audit-level=moderate`, typecheck, test, build web e build Tauri/prerender completati con esito positivo.

---

## 1. Executive Summary

L'applicazione **Gestore Pub** presenta un **livello di sicurezza complessivamente BUONO** per un'applicazione locale di gestione club, con un'architettura moderna basata su TanStack Start che separa chiaramente codice client/server. L'uso di Prisma ORM mitiga efficacemente i rischi di SQL Injection, l'autenticazione utilizza PBKDF2-SHA512 con 310.000 iterazioni (superiore alle raccomandazioni OWASP), e i cookie di sessione sono configurati correttamente (HttpOnly, Secure, SameSite=Strict).

Le vulnerabilità principali identificate nella prima analisi sono state mitigate per lo scenario di consegna previsto: **app desktop locale distribuita tramite GitHub Releases**. Restano aree di miglioramento operative per un uso più maturo: code signing, protezione del filesystem/account OS, backup cifrati, test di sicurezza più estesi e hardening specifico se l'app venisse esposta come servizio web pubblico.

**Rischio Residuo Stimato:** **MEDIO** per deployment web esposto su rete; **BASSO-MEDIO** per uso esclusivamente locale/desktop (Tauri) su computer protetto.

---

## 2. Vulnerabilità Identificate

### 2.1 [RISOLTA] Rate Limiting In-Memory Non Persistente né Distribuito

**Stato attuale:** risolto con tabella SQLite `RateLimitAttempt`, persistente tra riavvii.

**File:** `src/lib/api.functions.ts` (righe 160-220)

**Descrizione:**  
La prima versione del rate limiting per login (`loginAttempts` Map) e recupero password (`recoveryAttempts` Map) usava `Map` in-memory del processo Node.js. Quel modello presentava tre problemi critici:
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
// Stato attuale: RateLimitAttempt persistente su SQLite.
// Per deployment web multi-istanza usare uno store condiviso esterno
// come Redis/Upstash, mantenendo la stessa semantica di lockout.
```

---

### 2.2 [RISOLTA] Assenza Protezione CSRF per Server Functions

**Stato attuale:** risolto con middleware globale in `src/start.ts` per richieste non-GET, basato su `Origin` e `Sec-Fetch-Site`.

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

### 2.3 [RISOLTA] Esposizione Hash Password e Recovery Phrase nei Backup

**Stato attuale:** il backup standard non include hash password o hash risposta recupero. L'esportazione completa con credenziali non è esposta dalle API pubbliche; il restore accetta ancora vecchi backup completi solo per compatibilità/migrazione.

**File:** `src/lib/api.functions.ts` (funzione `exportBackupFn`, righe 1150-1250)

**Descrizione:**  
La prima versione di `exportBackupFn` esportava **tutti gli hash password** (`member.password`) e **tutti gli hash delle frasi di recupero** (`member.recovery_phrase_hash`) nel file JSON di backup, insieme ai token QR. Sebbene fossero hash (non plaintext), questo violava il principio di *minimizzazione dei dati* ed esponeva credenziali a:
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
      // RIMUOVERE: password, recovery_phrase_hash
      // password: member.password,        // <-- REMOVE
      // recovery_phrase_hash: member.recovery_phrase_hash,  // <-- REMOVE
      // qr_token resta nel backup standard per preservare la continuita delle tessere
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

### 2.4 [RISOLTA] Username Enumeration via Messaggi Errore Differenziati

**Stato attuale:** login e recupero password usano messaggi generici, dummy hash per utenti inesistenti e registrazione fallimenti anche quando l'utente non esiste.

**File:** `src/lib/api.functions.ts` (funzioni `loginFn` righe 650-690, `recoverPasswordFn` righe 580-640)

**Descrizione:**  
La prima analisi evidenziava possibili differenze tra "utente inesistente" e "password errata":
- Login: `recordLoginFailure` chiamato solo se utente esiste → messaggio generico "Credenziali non valide" ma **timing attack** possibile
- Recovery: `recordRecoveryFailure` chiamato prima di verificare esistenza utente → **stesso messaggio** ma logica diversa

Nel codice attuale i percorsi sono stati uniformati: `loginFn` e `recoverPasswordFn` controllano il rate limit prima della query, verificano sempre un hash reale o dummy, registrano sempre il fallimento e restituiscono messaggi non specifici.

**Scenario di Attacco (PoC Concettuale):**
```bash
# Enumerazione utenti via timing/recovery
for user in $(cat userlist.txt); do
  time curl -X POST /api/recoverPasswordFn -d "{\"username\":\"$user\",\"recovery_phrase\":\"wrong\",\"new_password\":\"NewPass123!\"}"
  # Analisi tempi risposta o rate limit per scoprire utenti validi
done
```

**Mitigazione applicata:**
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

### 2.5 [RISOLTA] Content Security Policy Assente in Tauri

**File:** `src-tauri/tauri.conf.json`

**Stato attuale:** CSP restrittiva configurata nel bundle Tauri.

**Descrizione:**  
Nella prima analisi l'applicazione Tauri non aveva una CSP restrittiva. In caso di XSS (es. via QR code malevolo, import backup corrotto, o future feature), un attaccante avrebbe potuto eseguire JavaScript arbitrario nel contesto dell'app desktop.

**Scenario di Attacco (PoC Concettuale):**
```javascript
// Vecchie versioni: QR code contenente payload malevolo per leggere dati dalla WebView
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

### 2.7 [RISOLTA] DevTools TanStack Limitati allo Sviluppo

**File:** `vite.config.ts` (riga 12: `devtools()` sempre attivo), `package.json` (devDependencies)

**Descrizione:**  
Il plugin `@tanstack/devtools-vite` era un punto da verificare perché, se registrato incondizionatamente, avrebbe potuto:
- Aumentare bundle size inutilmente
- Esporre route tree, loader data, mutation state se non strippato correttamente
- Lasciare codice di debugging in produzione

**Stato attuale:** `vite.config.ts` registra DevTools solo quando `command === 'serve'`, quindi la build produzione non include il plugin.

**Mitigazione:**
```typescript
plugins: [
  command === 'serve' && devtools(),
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
| `exportBackupFn` | **MEDIO** | Esfiltrazione massiva dati personali e token QR |
| `registerAttendanceFn` | **BASSO** | Input `member_id`/`qr_token` validato ma no rate limit |

### 3.2 Componenti Architetturali a Rischio

1. **Server Functions (TanStack Start):** Boundary client/server - tutte le mutazioni passano qui. Punto singolo di controllo ma anche singolo punto di fallimento.
2. **Prisma ORM:** Mitiga SQLi ma attenzione a `prisma.$queryRaw` (non usato nel codice analizzato - **OK**).
3. **Cookie di Sessione:** Unico meccanismo auth - **nessun header Authorization/Bearer token** (buono per CSRF, ma limita API programmatiche).
4. **Tauri IPC:** `src-tauri/src/main.rs` espone solo comandi custom per cartella export e database desktop in `app_data_dir`; mantenerli limitati a path applicativi e input validati.
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
       │         (PBKDF2)     (SQLite)               │
       │              │           │                  │
       ▼              ▼           ▼                  ▼
┌─────────────┐  ┌──────────┐ ┌────────┐      ┌──────────┐
│ App Data DB │  │ Cookies  │ │ SQLite │      │  Backup  │
│ (Desktop)   │  │ (Session)│ │ (RateL)│      │  (JSON)  │
└─────────────┘  └──────────┘ └────────┘      └──────────┘
                                                    │
                                            ┌───────┴───────┐
                                            ▼               ▼
                                      QR Token      No Password Hashes
```

---

## 4. Best Practice di Sicurezza Consigliate

### 4.1 Ciclo di Vita Sviluppo (SDLC)

| Fase | Raccomandazione | Priorità |
|------|-----------------|----------|
| **Development** | Abilitare `strict: true` in `tsconfig.json` (già presente) | ✅ Fatto |
| **Development** | Typecheck `tsc --noEmit` pulito e aggiunto come gate CI | ✅ Fatto |
| **Development** | Aggiungere `eslint-plugin-security` e regole `no-eval`, `no-unsanitized` | 🔴 Alta |
| **Pre-commit** | Husky + `lint-staged` per ESLint, Prettier, `npm audit` | 🟡 Media |
| **CI/CD** | GitHub Actions: `npm audit`, test e build su PR/push | ✅ Fatto |
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
// 3. tauri.conf.json - CSP minima Tauri v2
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';"
    }
  }
}
```

In Tauri v2 non usare esempi `allowlist` v1: il controllo principale resta sui comandi registrati in `invoke_handler`, che devono continuare a operare solo su file previsti dall'app e non su path arbitrari passati dal frontend.

### 4.3 Miglioramenti Codice Specifici

| Area | Azione | File |
|------|--------|------|
| **Rate Limiting** | Per deployment multi-istanza migrare da SQLite locale a Redis/Upstash condiviso | `api.functions.ts` |
| **CSRF** | Valutare double-submit cookie se l'app viene esposta come servizio web pubblico | `src/start.ts` |
| **Backup** | Valutare backup cifrato opzionale; il backup standard resta senza hash password/recupero | `api.functions.ts` |
| **Enum Utenti** | Mantenere messaggi e timing uniformi in login/recovery durante future modifiche | `api.functions.ts` |
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
# Verificare: `npm audit --audit-level=moderate` pulito al 2026-06-19
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
3. **Corruzione Database:** ripristino da backup più recente; per server SQLite verificare `PRAGMA integrity_check`, per desktop sostituire il file dati locale solo da backup affidabile
4. **QR Token Leak:** Rigenerare token per membri affetti → `UPDATE member SET qr_token = ...`

---

## Allegato A: Checklist Rapida Pre-Deploy

- [x] Rate limiting persistente (Redis/SQLite) implementato
- [x] CSRF protection su tutte le mutazioni POST
- [x] Backup standard non include password/recovery hash
- [x] Messaggi errore login/recovery unificati (no enum)
- [x] CSP configurato in `tauri.conf.json`
- [x] Database desktop fuori da `localStorage`, in file dati app con migrazione automatica
- [x] DevTools rimossi da build produzione
- [x] CI base con audit dipendenze, test e build
- [x] Typecheck `tsc --noEmit` pulito e aggiunto alla CI
- [ ] Headers sicurezza (HSTS, X-Frame-Options, etc.) configurati
- [ ] Audit logging per azioni admin
- [ ] Code signing certificati Tauri configurati
- [x] `npm audit --audit-level=moderate` pulito localmente e integrato in CI
- [ ] Test sicurezza (rate limit, auth bypass, backup restore) in CI

---

## Allegato B: Riferimenti Normativi

- **OWASP Top 10 2021:** A01 Broken Access Control, A02 Cryptographic Failures, A03 Injection, A07 Identification & Authentication Failures
- **OWASP ASVS 4.0:** V2 Authentication, V3 Session Management, V5 Validation, V7 Error Handling, V12 API Security
- **NIST SP 800-63B:** Digital Identity Guidelines (Password Verifiers, Rate Limiting)
- **GDPR Art. 32:** Security of processing (minimizzazione dati backup, cifratura)

---

*Report generato da analisi statica del codice (SAST) e revisione architetturale. Non include test dinamici (DAST) o penetration testing. Si raccomanda test di penetrazione manuale pre-go-live per deployment web pubblico.*
