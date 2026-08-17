# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

## [2.0.2] - 2026-08-17

Release di sola manutenzione: nessuna modifica funzionale né all'interfaccia utente. Raccoglie tre aggiornamenti di dipendenze a basso rischio già proposti da Dependabot.

### Aggiornato
- **@tanstack/react-router** aggiornato da 1.170.16 a 1.170.25 (patch).
- **@tanstack/router-plugin** aggiornato da 1.168.18 a 1.168.29 (patch).
- **lucide-react** aggiornato da 1.23.0 a 1.31.0: aggiornamento minor, tutte le icone usate dal progetto continuano a risolversi, verificato con `tsc --noEmit`.

### Tecnico
- `@tanstack/react-start` 1.168.26 richiede esattamente `@tanstack/react-router` 1.170.16, quindi il lockfile contiene ora copie annidate di quella versione. Il plugin Vite di TanStack Start applica `resolve.dedupe` su `@tanstack/react-router`, perciò il bundle client e server continua a usarne una sola copia.
- Allineato a 2.0.2 il numero di versione nel footer della pagina in `docs/`, rimasto fermo a 2.0.0.

### Sicurezza
- Nessuna vulnerabilità nota: `npm audit --audit-level=moderate` e `cargo audit` puliti.

## [2.0.1] - 2026-08-09

Release di sola manutenzione: nessuna modifica funzionale né all'interfaccia utente. Chiude tutte le vulnerabilità note segnalate da `npm audit` e `cargo audit`.

### Sicurezza
- **dompurify** portato a 3.4.13: risolve il bypass di `afterSanitizeElements` per gli elementi custom consentiti ([GHSA-c2j3-45gr-mqc4](https://github.com/advisories/GHSA-c2j3-45gr-mqc4)) e l'XSS dovuto al sottoalbero eseguibile lasciato staccato dalla rimozione dell'hook `IN_PLACE` ([GHSA-55q2-fjhq-7xh7](https://github.com/advisories/GHSA-55q2-fjhq-7xh7)).
- **postcss** portato a 8.5.26: risolve due path traversal nel caricamento automatico della source map via `sourceMappingURL`, che permettevano la lettura di file `.map` arbitrari ([GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)).
- **undici** portato a 7.29.0: risolve la desincronizzazione delle risposte a valle nell'interceptor di retry, la divulgazione di dati tra utenti diversi tramite direttive `Cache-Control` malformate, la CRLF injection via proprietà `type` di body blob-like e la cookie attribute injection ([GHSA-8xcm-r25x-g524](https://github.com/advisories/GHSA-8xcm-r25x-g524), [GHSA-4cwx-7wf7-3272](https://github.com/advisories/GHSA-4cwx-7wf7-3272), [GHSA-m8rv-5g2x-5cg5](https://github.com/advisories/GHSA-m8rv-5g2x-5cg5), [GHSA-jr45-8vmc-qm54](https://github.com/advisories/GHSA-jr45-8vmc-qm54), [GHSA-v3r7-h72x-cjcm](https://github.com/advisories/GHSA-v3r7-h72x-cjcm)).
- **js-yaml** portato a 4.3.1: risolve due casi di consumo quadratico di CPU, su catene di merge key e sulla risoluzione di `!!omap` ([GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj)).
- **shell-quote** portato a 1.10.0: risolve il denial of service a complessità quadratica in `parse()` ([GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv)).
- **nanoid** portato a 3.3.18: risolve i cicli infiniti dei generatori non sicuri con dimensione negativa o nulla ([GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)).
- **quick-xml** (Rust) portato a 0.41.0 tramite l'aggiornamento di `plist` a 1.10.0: risolve il tempo di esecuzione quadratico nel controllo degli attributi duplicati e l'esaurimento di memoria per allocazione illimitata delle dichiarazioni di namespace in `NsReader` ([RUSTSEC-2026-0194](https://rustsec.org/advisories/RUSTSEC-2026-0194), [RUSTSEC-2026-0195](https://rustsec.org/advisories/RUSTSEC-2026-0195)).

### Aggiornato
- **lucide-react** aggiornato da 0.545.0 a 1.23.0. Il salto di major è la stabilizzazione dell'API: tutte le 43 icone usate dal progetto continuano a risolversi, verificato con `tsc --noEmit`.
- **Tauri** (Rust) aggiornato da 2.11.3 a 2.11.5, con `tauri-runtime-wry` da 2.11.3 a 2.11.4.
- **tauri-plugin-single-instance** aggiornato da 2.4.2 a 2.4.3.
- **@tanstack/react-devtools** aggiornato da 0.10.5 a 0.10.8 (dipendenza di sviluppo).
- **@tanstack/devtools-vite** aggiornato da 0.8.0 a 0.8.1 (dipendenza di sviluppo).

### Tecnico
- Aggiunta una sezione `overrides` in `package.json` per forzare le versioni sicure di `dompurify`, `js-yaml`, `nanoid`, `postcss`, `shell-quote` e `undici`. Sono tutte dipendenze transitive: nessuna è dichiarata direttamente dal progetto, quindi non erano aggiornabili senza override.
- Verificato con `npm audit --audit-level=moderate` (0 vulnerabilità), `cargo audit` (0 vulnerabilità), typecheck, suite di test (12/12) e build.

### Note
- Restano aperti gli aggiornamenti a Prisma 7 (`prisma` e `@prisma/client`): richiedono una migrazione dedicata, perché la versione 7 non accetta più la proprietà `url` nel blocco `datasource` e impone un `prisma.config.ts` più un driver adapter al costruttore di `PrismaClient`.

## [2.0.0] - 2026-06-26

### Corretto
- **Permanenza dati desktop effettivamente attiva (corregge un bug critico introdotto in v1.0.2).** Da v1.0.2 (`withGlobalTauri: false`) l'app desktop non riusciva più a invocare i comandi Rust: `window.__TAURI__` non viene esposto in Tauri v2 con quel flag, e il progetto non usava `@tauri-apps/api`. Risultato: i dati venivano salvati in `localStorage` del webview invece che nel file `desktop-db.json`, e tutta la logica di persistenza/migrazione Rust era inerte. Ora il bridge usa `invoke` da `@tauri-apps/api/core` con rilevamento via `__TAURI_INTERNALS__`. I dati tornano a essere salvati nel file `desktop-db.json` nella cartella dati dell'app. **Migrazione automatica**: chi aveva usato la v1.1.2 desktop (dati in `localStorage`) ritrova tutto al primo avvio della 2.0.0 (migrazione `legacy-localStorage` → file).
- **Hash password legacy ri-hashati al login.** Al primo login valido, gli hash salvati in formati legacy deboli (`local$` base64 reversibile, `sha256$` a iterazione singola, `salt:hash` PBKDF2 a 1000 iterazioni) vengono rehashati con PBKDF2-SHA512 (310.000 iterazioni) e persistiti. Valido sia per la modalità desktop che server.
- **Scrittura atomica del DB non più distruttiva.** Se il `rename` del file temporaneo fallisce (su Windows può capitare per un antivirus che trattiene il file), l'app non cancella più il DB buono prima di ritentare: fa retry con backoff e, in caso di fallimento finale, preserva il DB esistente rimuovendo solo il temporaneo. Aggiunto anche `fsync` della directory per la durabilità su hard crash (macOS/Linux). Questo elimina il sintomo "sembra un reset" da DB perso.
- **`loadDb` non sovrascrive più un DB incoerente.** Se il file esiste ed è leggibile ma non contiene un account amministratore, l'app non crea più un admin vuoto azzerando i dati residui: mostra un errore che invita al ripristino backup o al reset esplicito.
- **Audit log persistito anche sui tentativi falliti.** Le voci `auth.login_failed`, `auth.recovery_failed` e `backup.exported` venivano perse (manca il salvataggio sui path di errore/export). Ora vengono persistite.

### Sicurezza
- **Single-instance lock.** Aggiunto `tauri-plugin-single-instance`: impedisce di aprire una seconda finestra dell'app. Il DB desktop è letto intero, modificato in memoria e riscritto intero: due istanze concorrenti causavano lost update (presenze/soci persi).
- **`open_external_url` validato con parsing robusto.** Usa `url::Url::parse` (scheme `http`/`https`, sanitizzazione di metacaratteri shell) invece di un semplice controllo di prefisso. Difesa in profondità: l'URL della release GitHub è ora whitelistato su `github.com/Francy2009/The-Club/` prima di essere aperto nel browser di sistema.
- **Enumerazione utenti via recovery question rimossa (desktop).** `getRecoveryQuestionFn` ora risponde `hasRecovery: true` costante, allineandosi al path server e non rivelando più se uno username esiste o se ha il recupero configurato.

### Tecnico
- Aggiunta dipendenza `@tauri-apps/api` (bridge `invoke`), `tauri-plugin-single-instance` e `url` (Rust).
- `withGlobalTauri` resta `false` (hardening di v1.0.2 mantenuto): l'API globale non è esposta, si usa l'import dal pacchetto.
- Verificato con typecheck, suite di test (12/12), build web, build Tauri (prerender), `cargo check`, `npm audit` (0 vulnerabilità).

### Note
- Major bump perché cambia in modo significativo il meccanismo di persistenza desktop (da `localStorage` a file `desktop-db.json`), con migrazione automatica dei dati delle versioni 1.1.x desktop. Nessuna modifica funzionale all'interfaccia utente.

## [1.1.2] - 2026-06-26

### Aggiornato
- **React** aggiornato da 19.2.6 a 19.2.7 (patch di manutenzione).
- **React DOM** aggiornato da 19.2.6 a 19.2.7 (patch di manutenzione).
- **@types/react** aggiornato da 19.2.15 a 19.2.17 (definizioni TypeScript allineate a React 19.2.7).
- **Vite** aggiornato da 8.0.16 a 8.1.0 (tool di build/dev server).
- **jsdom** aggiornato da 28.1.0 a 29.1.1 (ambiente di test, dipendenza di sviluppo).
- **GitHub Actions — configure-pages** aggiornato da 5 a 6.
- **GitHub Actions — upload-pages-artifact** aggiornato da 3 a 5.
- **GitHub Actions — deploy-pages** aggiornato da 4 a 5.

### Fix
- **CI: `cargo audit` eseguito dalla directory `src-tauri`**: il controllo di sicurezza delle dipendenze Rust veniva lanciato con `--manifest-path`, che in alcuni casi non risolveva correttamente il workspace. Ora viene eseguito direttamente dalla directory `src-tauri`, senza `--manifest-path`, per un rilevamento affidabile delle vulnerabilità.

### Note
- Release di manutenzione: nessuna modifica funzionale al comportamento dell'app. Tutte le modifiche sono aggiornamenti di dipendenze (patch/minor) e una correzione del workflow CI. Verificato con typecheck, suite di test (12/12 superati) e build di produzione.

## [1.1.1] - 2026-06-25

### Sicurezza
- **Recovery question hashata anche in modalità desktop**: la domanda di recupero dell'amministratore viene ora hashata con PBKDF2-SHA512 anche nel file locale `desktop-db.json`, allineandosi al comportamento della modalità server. Le domande salvate in chiaro dalle versioni precedenti vengono migrate automaticamente al primo avvio.
- **Rate limiting persistente in modalità desktop**: i tentativi falliti di login e recupero password sono ora salvati nel database locale e sopravvivono ai riavvii dell'app, come avviene già nella modalità server.
- **Audit log delle azioni amministrative**: aggiunta una traccia interna per azioni sensibili (login/logout, cambio password, creazione/eliminazione soci, rinnovi, registrazione presenze, export/restore, eliminazione presenze). In modalità desktop i log restano nel file locale; in modalità server vengono scritti nella tabella `AuditLog`.
- **Capability Tauri ridotte al minimo**: rimossi i permessi `core:default` ridondanti e i permessi non utilizzati, lasciando solo quelli strettamente necessari (`core:app:default`, `core:window:default`, `core:webview:default`, `core:path:default`).
- **Disabilitata l'API privata di macOS**: `macOSPrivateApi` è ora `false` e la feature `macos-private-api` è stata rimossa da `Cargo.toml`, dato che l'app non ne fa uso.
- **Audit delle dipendenze Rust**: aggiunto `cargo audit` ai workflow CI e release.

## [1.1.0] - 2026-06-25

### Modificato
- **Rimosso il supporto Linux**: l'app ora viene distribuita solo per Windows e macOS. Su Linux il framework (Tauri) usa una libreria di sistema chiamata `glib`, che aveva un bug di sicurezza segnalato da Dependabot. Non potevamo correggerlo da soli, perché la versione con il fix richiede un aggiornamento del framework stesso, ancora non disponibile. Piuttosto che spedire codice con un problema di sicurezza noto, abbiamo preferito sospendere il supporto Linux in attesa della correzione a monte. Su Windows e macOS il funzionamento non cambia: la libreria in questione non viene nemmeno inclusa in quei binari.

## [1.0.4] - 2026-06-25

### Fix
- **Riepilogo, selettore del mese delle scadenze**: andava solo all'indietro, da questo mese fino a un anno prima. Per le tessere in scadenza ha più senso guardare avanti, per sapere quali soci scadranno nei prossimi mesi e poter stampare le tessere in anticipo. Ora il selettore parte da questo mese e va avanti fino a un anno. Il selettore del riepilogo eventi resta all'indietro, perché gli eventi si chiudono mese per mese e si rivedono a posteriori.
- **PDF della tessera appena creato il socio**: la tessera scaricata subito dopo aver creato il profilo mostrava in fondo due scritte rosse, grandi e sovrapposte. Il footer ereditava il font grande e il colore rosso usati poco sopra per il numero tessera, senza mai resettarli. Ora il footer è identico a quello della tessera scaricabile dalla pagina soci: testo grigio, piccolo, niente sovrapposizione. I due PDF adesso sono effettivamente lo stesso.

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

[Unreleased]: https://github.com/Francy2009/The-Club/compare/v2.0.2...HEAD
[2.0.2]: https://github.com/Francy2009/The-Club/releases/tag/v2.0.2
[2.0.1]: https://github.com/Francy2009/The-Club/releases/tag/v2.0.1
[2.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v2.0.0
[1.1.2]: https://github.com/Francy2009/The-Club/releases/tag/v1.1.2
[1.1.1]: https://github.com/Francy2009/The-Club/releases/tag/v1.1.1
[1.1.0]: https://github.com/Francy2009/The-Club/releases/tag/v1.1.0
[1.0.4]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.4
[1.0.3]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.3
[1.0.2]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.2
[1.0.1]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.1
[1.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v1.0.0
