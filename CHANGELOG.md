# Changelog

Tutte le modifiche rilevanti di questo progetto saranno documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/),
e questo progetto aderisce al [Semantic Versioning](https://semver.org/lang/it/).

## [Unreleased]

### Tecnico
- **Il workflow di release non rigenera più `Cargo.lock`.** `release.yml` eseguiva `cargo generate-lockfile` *dopo* `cargo audit`: la build distribuita veniva quindi compilata da un albero di dipendenze risolto al momento del tag, diverso sia da quello committato sia da quello controllato dall'audit. I pin potevano sparire proprio nei pacchetti che arrivano agli utenti — per esempio `tokio` 1.54.1, che chiude l'unsoundness di `AsyncFd::new` ([RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386)). Lo step è sostituito da `cargo metadata --locked`, che fallisce se `Cargo.lock` non è allineato a `Cargo.toml`, e `cargo check` ora gira con `--locked`. Lo stesso controllo è stato aggiunto in `ci.yml`, così un lockfile disallineato emerge sulla PR in pochi secondi invece che al momento del tag. Verificato in locale: il lockfile attuale passa, un lockfile con un pacchetto rimosso fa fallire il comando con `--locked`.

## [3.0.3] - 2026-10-29

Release di manutenzione e sicurezza. Nessuna modifica funzionale né all'interfaccia utente, nessun cambio di schema del database, nessun file dati toccato: chiude tutte le voci segnalate da `npm audit` sul lockfile della 3.0.2 (19 voci: 9 critiche, 6 alte, 4 moderate) e riconcilia le PR Dependabot aperte in un unico intervento verificabile.

### Sicurezza
- **@tanstack/react-start** 1.168.49 → 1.169.4 e **@tanstack/start-server-core** (transitiva) 1.169.31 → 1.169.45: chiude l'XSS riflessa non autenticata nelle risposte dei server function ([GHSA-qx66-fv34-fjm8](https://github.com/advisories/GHSA-qx66-fv34-fjm8), critica). **Raggiungibilità: non determinata.** L'advisory descrive una catena che attraversa il trasporto dei server function (payload malformato che finisce per errore vista come `Response`), codice interno di `start-server-core` che non si può inferire dall'esterno se non provandolo con un payload creato ad hoc su ogni versione; in locale non è stata riprodotta. La superficie, però, esiste in tutti e due i percorsi: su `main` è attiva la modalità server, dove l'app espone 22 server function (`setupValidator`, `loginFn`, `recoverPasswordFn`, …) e le rotte, non tutte protette dal login; nel bundle desktop i server function sono compilati in un `fetch` verso la propria origine e, in Tauri, la pagina è servita dalla propria origine, quindi la premessa "HTML controllato dall'attaccante sulla stessa origine" non si può escludere a priori. L'aggiornamento resta necessario in ogni caso.
- **La PR Dependabot #55 non bastava.** Si fermava a `@tanstack/react-start` 1.168.59, mentre per chiudere l'advisory serve almeno la 1.168.60; e per `@tanstack/start-server-core`, che è transitiva e seguiva `react-start`, serviva almeno la 1.169.39. Com'è stato fatto per la 3.0.0, l'intero gruppo `@tanstack/*` è stato mosso insieme (`react-router` 1.170.32 → 1.170.46, `router-plugin` 1.168.35 → 1.168.48, `react-router-ssr-query` 1.167.2 → 1.167.3, `react-devtools` 0.10.12 → 0.10.13, `react-router-devtools` 1.167.1 → 1.167.2; `devtools-vite` resta 0.8.5, l'ultima pubblicata): `react-start` dipende da una versione *esatta* di `react-router` ed è esattamente il disallineamento fra i due pacchetti che aveva rotto il prerendering desktop nella 2.0.2. Verificato: `npm ls @tanstack/react-router` mostra una sola copia, la 1.170.46, e `npm run build:tauri` completa il prerendering.
- **fast-uri** forzato a 3.1.9 tramite `overrides`: chiude lo spoofing dello scheme via octet percent-encoded ([GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), moderata) e, nello stesso range, altre cinque advisory (due alte: host confusion con parentesi non chiusa e port non validato in `serialize`; tre moderate e una bassa: normalizzazione dell'host, equivalenza dei path, host confusion WHATWG, `:` non escapato nei suffix reference). Arriva come transitiva di `ajv`, che chiede `^3.0.1` e quindi lo porterebbe alla 3.1.9 anche da solo; l'override è esplicito per fissarlo nel lockfile, perché Dependabot lo aveva proposto solo alla 3.1.8 (#53), che chiude la sola GHSA-58mr-gqgx-xq4g. **Raggiungibilità: non evidenziata.** `ajv` non è usato dal codice dell'app: entra solo nella catena di build di `@tanstack/router-plugin`/`start-plugin-core` (validazione formati e schemi) ed è caricato al massimo durante la compilazione, su input controllati dallo sviluppatore.
- **dompurify** forzato a 3.4.17 tramite `overrides` (era 3.4.13): chiude il bypass di `SAFE_FOR_TEMPLATES` con espressione spezzata in un shadow root reattivo ([GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), critica), il hook `IN_PLACE` che lascia handler attivi sul sottoalbero staccato ([GHSA-p98j-92pf-mc4p](https://github.com/advisories/GHSA-p98j-92pf-mc4p), bassa, e il suo fix incompleto [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr), alta), la reparse di un root rawtext rimosso a forza ([GHSA-6688-9rhm-gjv2](https://github.com/advisories/GHSA-6688-9rhm-gjv2), bassa) e il controllo `attributeName=href` di SMIL saltato con `PARSER_MEDIA_TYPE` XHTML ([GHSA-c6gr-qvv4-5v3f](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f), bassa). Arriva solo dentro `jspdf`, che la pinna. **Raggiungibilità: non evidenziata.** Nel codice non c'è alcun `dangerouslySetInnerHTML`, `innerHTML` o `insertAdjacentHTML`, quindi DOMPurify non viene mai chiamato con HTML che l'app debba rendere, e `jspdf` viene usato solo in costruzione: nessun testo dei soci finisce in un documento HTML; i PDF si compongono con `text()`/`lines()`, che non passano da DOMPurify, e i nomi lunghi vengono già troncati in ricomposizione (nessun valore arriva a un `eval` o a un parser di markup). Gli avvisi riguardano percorsi (hook `IN_PLACE`, shadow root, SMIL) che presuppongono chiamate dirette all'API di sanitizzazione.
- **undici** forzato a 7.30.1 tramite `overrides` (era 7.29.0): chiude 17 advisory nello stesso range, fra cui due alte — bypass della validazione dei certificati TLS in `Agent` e nei `connect` opzioni di `BalancedPool` ([GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx), [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3)) —, la cache poisoning su redirect cross-origin ([GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26)), il DoS sulle content-encoding in eccesso ([GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)) e il DoS sulla renegotiation TLS 1.2 ([GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm)), oltre ai DoS su WebSocket, `EventSource` e decompressione e alla divulgazione di cookie. Resta la 7.x, la linea che `jsdom` (30.0.1 → 30.1.3) pretende (`^7`); `undici` non è una dipendenza diretta e non viene importato dal codice dell'app. **Raggiungibilità: non evidenziata.** L'unica `fetch` di rete dell'app è il controllo aggiornamenti verso l'API pubblica di GitHub (`src/lib/update-check.ts`), che usa il `fetch` della piattaforma (in Tauri, quello di WebKit/WebView2) e non `undici`; nel bundle Tauri non c'è un runtime Node.
- **shell-quote** forzato a 1.11.0 tramite `overrides` (era 1.10.0): chiude la command injection in `quote()` quando un token con terminatore di riga segue un token `{ comment }` ([GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv), critica). È l'ultima patch necessaria: la 1.12.0 è un minor e qui non serve. **Raggiungibilità: non evidenziata.** L'unico genitore è `launch-editor`, che compare solo nel grafo di sviluppo (via `@tanstack/devtools-bundler-core`). Inoltre `launch-editor` non chiama `quote()`: usa `splitArgs`/`escapeCmdArgs`, e la funzione vulnerabile non viene mai eseguita; resta nell'albero solo come codice non raggiunto.
- **vitest** e **@vitest/mocker** 4.1.11 → 4.1.12: chiudono la registrazione di mock manuali non autenticati che consente code injection ([GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), moderata) e il bypass della allowlist del redirect su Windows con backslash ([GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp), moderata). **Raggiungibilità: non evidenziata.** Riguarda il server di test, che esiste solo se viene avviato a mano con `vitest`, in locale; non fa parte di ciò che viene compilato né distribuito (build e `npm test` da CLI non espongono un server HTTP). Resta volontariamente ferma a 4.1.12: la major 5.0.0 (#47) è una decisione a parte.
- **vite** 8.2.2 → 8.3.5 e **launch-editor** 2.14.2: chiudono, in Vite, la servizione di path fuori da `server.fs.allow` quando il percorso del progetto coincide con un percorso di sistema ([GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), moderata), l'esposizione dei primi 4 byte di file esterni a `server.fs` con `?vite-wasm-instance` ([GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg), moderata) e l'esecuzione di script cross-origin da middleware personalizzati ([GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), bassa); in `launch-editor`, il bypass del controllo di esistenza su Windows ([GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), alta, che copre anche Vite), l'interpretazione di un percorso come flag CLI per alcuni editor ([GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), moderata) e l'escaping di `%` mancante ([GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), moderata). **Raggiungibilità: non evidenziata.** Sono tutti difetti del dev server e dell'apertura dell'editor: `vite` esiste solo in sviluppo (la build usa Rolldown e non espone un server; in `vite.config.ts` devtools e HTTPS di sviluppo sono attivi solo con `command === 'serve'`), e l'app non fornisce né endpoint di dev server né un editor da aprire. Nel bundle distribuito non c'è code che serva file fuori dai permessi del progetto.
- **source-map-js** forzato a 1.2.2 tramite `overrides` (era 1.2.1): chiude il DoS dell'event loop tramite gli offset di sezione di una source map indicizzata ([GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), alta). Fissarlo qui invece di alzare i genitori (`postcss`, `css-tree`, `@tailwindcss/*`) è più piccolo e più mirato: tutti chiedono `^1.2.1`, quindi la 1.2.2 resta dentro il range di ciascuno. **Raggiungibilità: non evidenziata.** Le source map vengono lette solo in compilazione, e l'app non ne legge di utente; nel bundle non c'è codice che consumi source map.
- **seroval** forzato a 1.6.12 tramite `overrides` (era 1.6.4, e 1.5.6 sotto `solid-js`): chiude il DoS per lunghezze `TypedArray` non controllate nella deserializzazione JSON ([GHSA-jp82-f5mq-hwhp](https://github.com/advisories/GHSA-jp82-f5mq-hwhp), alta). **Raggiungibilità: non evidenziata.** `solid-js` sta solo nell'albero dei devtools, che non viene importato in produzione; l'`SSR` di TanStack aveva già la sua 1.6.4. La **versione scelta non è l'ultima (1.7.3) di proposito**: `solid-js` 1.9.17 pinna `seroval` e `seroval-plugins` a `~1.6.8`, e `~` non accetta la 1.7, quindi la scelta è fra una 1.6.x (la 1.6.8+) e un albero incoerente con `seroval` 1.7 e `seroval-plugins` 1.6. La 1.6.12 è l'ultima 1.6 e chiude l'advisory; la 1.7 arriverà con `solid-js` 2.x.
- **solid-js** (transitiva) 1.9.15 → 1.9.17 tramite `react-devtools` 0.10.13: la 1.9.15 resta critica finché il suo range di `seroval` (`~1.5.4`) porta una 1.5.x vulnerabile ([GHSA-p6vx-979v-rg4c](https://github.com/advisories/GHSA-p6vx-979v-rg4c), critica). La 1.9.17 chiede `~1.6.8`, dentro il range che chiude l'advisory. Non serve un override su `solid-js`: basta il genitore. **Raggiungibilità: non evidenziata**, per gli stessi motivi di `seroval` (solo devtools).
- **zod** (transitiva) 4.5.4 → 4.6.7: chiude l'esaurimento di memoria nella validazione di collezioni con vincoli sovradimensionati ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), alta). La porta `@tanstack/start-plugin-core` (e `router-generator`/`router-plugin`) con `^4.5.4`: non c'è un genitore da "fermare", la riduzione arriva dall'aggiornamento del gruppo TanStack. **Raggiungibilità: non evidenziata.** `zod` non è una dipendenza diretta: l'app valida l'input dei server function a mano (`assertRecord`, `requiredString`, … in `api.functions.ts`), con limiti di lunghezza espliciti, e nessuno schema zod viene costruito su dati dell'utente. Il caricamento del pacchetto avviene nel plugin di build, sui contenuti del progetto.
- **postcss-selector-parser** forzato a 6.1.5 tramite `overrides` (era 6.0.10): chiude la complessità quadratica nel parsing dei selettori piatti ([GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf), moderata). È un override **mirato** perché l'unico genitore, `@tailwindcss/typography` 0.5.20, la pinna alla `6.0.10` *esatta*: aggiornare il genitore non serve (0.5.20 è l'ultima pubblicata) e l'override non è sostituibile con un bump. La 6.1.5 è l'ultima patch della linea 6, compatibile con l'import (nessuna API utilizzata da typography è cambiata); la 7.x sarebbe un major di un'altra linea. **Raggiungibilità: non evidenziata.** Typography compila classi CSS statiche al momento della build (`styles.css` contiene solo `@plugin "@tailwindcss/typography";`); il testo che l'app mostra non viene mai passato al parser dei selettori (in tutta l'app non c'è `.prose` né rendering di Markdown).
- **Prisma** 7.10.0 → 7.10.1 (client, adapter e CLI). **Raggiungibilità: non applicabile** (nessuna advisory aperta: `npm audit` non la segnala). Rientra nel gruppo `minor-e-patch` della PR #61; dopo il bump la CLI `prisma` è stata rilanciata con `npm run db:generate` per rigenerare il client.
- **Rust / Tauri** 2.11.5 → 2.12.5, `tauri-plugin-single-instance` 2.4.4 → 2.5.5, `tauri-build` 2.6.3 → 2.7.4: nessuna advisory Rust nuova da chiudere (`cargo audit` era e resta a 0 vulnerabilità). L'aggiornamento però rimuove due famiglie di crate non più manutenute a valle di Tauri (`unic-*`, `dtor`) e toglie un avviso "unsound": `cargo update` lasciato a sé teneva `tokio` alla 1.53.1, quindi è stato fissato esplicitamente alla **1.54.1**, che contiene la correzione di `AsyncFd::new` ([RUSTSEC-2026-0386](https://rustsec.org/advisories/RUSTSEC-2026-0386), "unsound": è un rischio di I/O safety, non una vulnerabilità con advisory). Restano 5 avvisi, tutti su crate Linux: `glib` ([RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429), l'unsoundness che in 1.1.0 ha fatto sospendere il supporto Linux), `zbus_names`/`zvariant`/`zvariant_derive` (via `zbus`, che `single-instance` usa solo su Linux) e `proc-macro-error`. Su Windows e macOS questi crate non entrano nel build: `glib` arriva solo dalla catena GTK (`gtk` → `atk`) e `zbus`/`zvariant` solo dal ramo Linux di `single-instance`, quindi non riguardano i tre job di release (Windows, macOS Intel, macOS aarch64). Era il caso della PR #54, che fermava la Tauri a 2.12.0: qui si è presa l'ultima 2.12.x e le ultime patch dei crate Tauri.

### Aggiornato
- **Gruppo minor-e-patch** (PR #61): `@prisma/client` e `@prisma/adapter-better-sqlite3` 7.10.0 → 7.10.1, `prisma` (CLI) 7.10.0 → 7.10.1, `@tauri-apps/api` `^2.11.1` → `^2.12.4` (installa la 2.12.4), `lucide-react` 1.38.0 → 1.63.0, `react` e `react-dom` 19.2.8 → 19.3.1, `@types/react` 19.2.18 → 19.3.0, `@types/react-dom` 19.2.5 → 19.3.0, `@types/node` 26.4.1 → 26.6.6, `@testing-library/dom` 10.4.1 → 10.4.2, `@vitejs/plugin-react` 6.1.1 → 6.1.2, `jsdom` 30.0.1 → 30.1.3. `lucide-react` è salita alla 1.63.0 e non alla 1.60.0 della PR perché nel frattempo ne sono uscite tre patch/minor: tutte le 43 icone usate dal progetto continuano a risolversi (`tsc --noEmit` pulito).
- **React 19.3.1 e `@types/react` 19.3.0 restano**, non sono stati bloccati: typecheck, i 12 test e le due build passano. Se in future release si presentano errori di tipo sul solo aggiornamento dei tipi, la strada è tenere fermo `react` e annotarlo qui, come previsto.
- **vite** `^8.1.0` → `^8.3.5` e **vitest** 4.1.12 (PR #60, #62, #63): tutte dentro il range delle peer di `vitest` 4.1.12 (`vite ^6 || ^7 || ^8`).
- **`@tanstack/devtools-vite`** resta 0.8.5: è l'ultima pubblicata, la PR #55 non la toccava.

### Corretto
- **Server function di TanStack Start: `.inputValidator()` rinominato in `.validator()`.** `@tanstack/react-start` 1.169 ha rinominato il metodo con cui si dichiara il validatore di input; la 1.168.49 (quella su `main`) non lo aveva. I 14 validatori di `src/lib/api.functions.ts` sono stati migrati meccanicamente, senza toccare né i controlli né il tipo di dato accettato: le 14 righe cambiate sono l'unica differenza del file. Era l'unica rottura di tipo introdotta dagli aggiornamenti: a typecheck, i 35 errori `TS2339`/`TS7031`/`TS7006` (14 + 14 + 7) erano tutti conseguenza di questa rinomina, perché `data` restava `any`. Nessun altro import o API dell'app è cambiato.

### Tecnico
- **`cargo generate-lockfile` non è stato usato da solo.** Rigenerare il lockfile da zero con il nuovo `Cargo.toml` cambiava l'intero albero (crate estranee a Tauri, 26 pacchetti rimossi, `time` e `ctor` risolte diversamente). Si è invece partiti dal `Cargo.lock` di `main` e si è aggiornato solo quello che serve con `cargo update -p tauri|tauri-build|tauri-plugin-single-instance`, che ha portato 62 crate, tutti a valle di Tauri (`wry` 0.55.1 → 0.57.1, `tao`, `muda`, `tauri-runtime*`, `webview2-com`, `windows*`, `brotli`, …) e nessuno su cui il progetto abbia policies o pin. più `tokio` fissata con `cargo update -p tokio --precise 1.54.1`. Il lockfile regge `cargo check` e `cargo audit`.
- **npm e lockfile.** Il lockfile è stato rigenerato da zero con **npm 11** (quello che usa la CI con Node 24). Con npm 10.9.7 (Node 22, in locale), `react` 19.3.1 fa crashare l'arborista con `TypeError: Cannot read properties of null (reading 'edgesOut')` anche sul `package.json` della sola 3.0.2: è un difetto di npm 10 con le peer opzionali, non un problema dell'albero. La CI esegue `npm ci` con Node 24, quindi non lo incontra; chi ha Node 22 e deve rigenerare il lockfile deve usare npm 11.
- Nuovi `overrides`: `fast-uri` 3.1.9, `postcss-selector-parser` 6.1.5, `seroval` 1.6.12, `seroval-plugins` 1.6.12, `launch-editor` 2.14.2 e `source-map-js` 1.2.2 (questi ultimi due coprono anche dove il genitore diretto non viene aggiornato: `devtools-bundler-core` pinna `^2.14.1` di `launch-editor`, `solid-js` pinna `seroval` a `~1.6.8`). Aggiornati `dompurify` 3.4.13 → 3.4.17, `shell-quote` 1.10.0 → 1.11.0, `undici` 7.29.0 → 7.30.1. Gli override della 2.0.1 su `js-yaml`, `nanoid`, `postcss`, `mysql2`, `deepmerge-ts` restano invariati e restano necessari.
- `npm audit --audit-level=moderate` → **0 vulnerabilità** (da 19 voci: 9 critiche, 6 alte, 4 moderate). Sul repository gli alert Dependabot npm sono passati da 24 aperti a **0**: la scansione successiva al merge in `main` ha chiuso 29 alert (i 24 già segnalati più quelli che il lockfile della 3.0.2 non faceva emergere). Restano aperti solo gli alert Rust, che `cargo audit` non considera vulnerabilità.
- Verificato in locale, sull'intera pipeline della CI: `npm ci` (lockfile rigenerato), `npm audit --audit-level=moderate` (0 vulnerabilità), `npm run db:generate`, `typecheck`, test 12/12, `npm run build`, `npm run build:tauri` con prerendering completato (1 pagina), `cargo check --manifest-path src-tauri/Cargo.toml` e `cargo audit` (0 vulnerabilità, 5 avvisi su crate Linux, erano 11).
- Nessun file dati, `.env`, database o bundle generato nei commit: `git diff --stat` tocca solo `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src/lib/api.functions.ts` e questo file.

## [3.0.2] - 2026-09-09

Release di manutenzione. Nessuna modifica al comportamento dell'app o ai pacchetti distribuiti.

### Aggiornato
- **@types/node** 24.13.3 → 26.4.1: definizioni TypeScript usate solo nello sviluppo e nella CI. La pipeline completa — inclusi typecheck, test e build Tauri — è stata rieseguita con esito positivo.

## [3.0.1] - 2026-09-09

### Sicurezza
- **mysql2** forzato a 3.24.3 tramite `overrides`: risolve il downgrade del plugin di autenticazione a `mysql_clear_password`, che permette a un server MySQL ostile o a un MITM di farsi inviare la password in chiaro ([GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr), alta), e l'inflate zlib senza limiti nel gestore del protocollo compresso, sfruttabile come decompression bomb ([GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3), moderata). Arriva come dipendenza transitiva di `prisma`, che lo pinna alla 3.15.3 *esatta*: come già per `deepmerge-ts` nella 3.0.0, aggiornare Prisma non avrebbe risolto nulla e l'unica strada è l'override. Senza, `npm audit --audit-level=moderate` fallisce, e con esso sia la CI su ogni PR sia il workflow di release, che esegue lo stesso controllo prima di costruire i pacchetti.
- **La versione minima non è la 3.22.0 indicata dall'avviso Dependabot.** Quella chiude la sola GHSA-3f6p-5ww8-9rcr; la seconda advisory copre l'intero range `<=3.23.0`, quindi con la 3.22.0 l'audit sarebbe rimasto rosso. Il primo valore che chiude entrambe è la 3.24.0, e qui si è scelta la 3.24.3, ultima stabile.
- Nessuna delle due vulnerabilità era raggiungibile dall'app: `prisma/schema.prisma` dichiara `provider = "sqlite"` e il client usa `@prisma/adapter-better-sqlite3`, quindi il driver MySQL non viene mai caricato e nel codice non compare alcun riferimento a MySQL. L'override serve a sbloccare l'audit, non a chiudere un percorso sfruttabile in produzione.

### Tecnico
- L'override tocca il solo sottoalbero di `mysql2` (3.15.3 → 3.24.3): escono `denque`, `seq-queue` e `sqlstring`, entra `sql-escaper`, per tre pacchetti netti in meno. Nessun'altra dipendenza cambia versione.
- Verificato in locale sull'intera pipeline della CI: `npm ci`, `npm audit --audit-level=moderate` (0 vulnerabilità), `prisma generate`, `typecheck`, test 12/12, `build` e `build:tauri` con prerendering completato.

## [3.0.0] - 2026-09-01

Manutenzione dipendenze. Nessuna modifica funzionale né all'interfaccia utente: il salto di major segnala l'entità del rinnovamento interno — Prisma 7 con driver adapter, TypeScript 7, e la prima dipendenza nativa nell'albero — non un cambio di comportamento dell'app.

### Sicurezza
- **deepmerge-ts** forzato a 8.0.2 tramite `overrides`: risolve l'esaurimento dello stack nel merge di grafi di oggetti ricorsivi ([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)). Arriva come dipendenza transitiva di `prisma` attraverso `@prisma/config`, che la pinna alla 7.1.5 esatta: passare a Prisma 7 non avrebbe risolto nulla, perché anche `@prisma/config` 7.9.1 pinna la stessa versione. Senza override `npm audit --audit-level=moderate` falliva, e con esso sia la CI su ogni PR sia il workflow di release, che esegue lo stesso controllo prima di costruire i pacchetti.
- **anyhow** (Rust) portato da 1.0.102 a 1.0.104: risolve l'unsoundness in `Error::downcast_mut()` ([RUSTSEC-2026-0190](https://rustsec.org/advisories/RUSTSEC-2026-0190)).

### Corretto
- **Rimosso il blocco su `@tanstack/react-router` introdotto in 2.0.3.** La diagnosi di allora va precisata: la regressione del prerendering (`TypeError: matchedRoutes is not iterable`) non dipendeva dalla versione del router in sé, ma dal suo disallineamento con `@tanstack/react-start`, che dipende da una versione *esatta* di `@tanstack/react-router` (la 1.168.26 richiede la 1.170.16). Alzando il solo router l'albero finiva per contenere due versioni diverse dello stesso pacchetto; muovendo i tre pacchetti insieme `npm run build:tauri` completa il prerendering senza errori, verificato sia con la terna 1.170.29/1.168.32/1.168.46 sia con quella attuale.

### Aggiornato
- **Prisma** 6.19.3 → 7.10.0 (major), con la migrazione che la 7 impone. La URL del database non può più stare in `schema.prisma` e vive ora in un `prisma.config.ts` alla radice, dove serve soltanto alla CLI (`migrate`, `db push`, `studio`); il client non apre più il database da sé ma vuole un driver adapter esplicito, qui `@prisma/adapter-better-sqlite3` su `better-sqlite3`. La costruzione del client sta in un punto solo, `src/lib/prisma-client.ts`, usato sia dal singleton di `src/lib/db.ts` sia dai tre script in `prisma/`. Il generator resta `prisma-client-js`, ancora supportato in 7.10, quindi il client continua a essere generato in `node_modules` e nessun import cambia.
- **`better-sqlite3`** entra nell'albero come dipendenza dell'adapter, e non è dichiarata fra quelle dirette: il codice non la importa mai, e dichiararla porterebbe Dependabot a proporne la 13, che l'adapter non userebbe — `@prisma/adapter-better-sqlite3` 7.10 dipende da `^12.6.0`, quindi si ritroverebbe una seconda copia annidata. È comunque la prima dipendenza nativa del progetto: verificato che i binari precompilati esistano per Node 24 su `win32-x64`, `darwin-x64` e `darwin-arm64`, cioè le tre piattaforme dei job di release, quindi `npm ci` li scarica e non deve compilare nulla.
- **TanStack**, aggiornati in blocco: `@tanstack/react-router` 1.170.16 → 1.170.32, `@tanstack/router-plugin` 1.168.18 → 1.168.35, `@tanstack/react-start` 1.168.26 → 1.168.49, `@tanstack/react-router-ssr-query` 1.167.1 → 1.167.2, più i devtools (`react-router-devtools` 1.167.1, `react-devtools` 0.10.12, `devtools-vite` 0.8.5).
- **react** e **react-dom** 19.2.7 → 19.2.8, **lucide-react** 1.31.0 → 1.38.0, **tailwindcss** e **@tailwindcss/vite** 4.3.0 → 4.3.3.
- Dipendenze di sviluppo: **vite** 8.1.0 → 8.2.2 (già dentro il range `^8.1.0`, ora fissata nel lockfile), **vitest** 4.1.9 → 4.1.11, **@vitejs/plugin-react** 6.0.2 → 6.1.1, **@testing-library/react** 16.3.2 → 16.3.3, **@types/react** 19.2.17 → 19.2.18, **@types/react-dom** 19.2.3 → 19.2.5.
- **@types/node** 22.19.19 → 24.13.3 e **jsdom** 29.1.1 → 30.0.1: due major, entrambi di solo sviluppo. Il salto di `@types/node` allinea i tipi alla versione di Node effettivamente usata da CI e release (24), prima disallineata di due major.
- **TypeScript** 6.0.3 → 7.0.2 (major). È il port nativo del compilatore, e cambia il modo in cui `tsc` viene distribuito: non più JavaScript, ma un binario per piattaforma tirato dentro come `optionalDependencies` di `typescript`. Per questo repo conta, perché `release.yml` esegue `npm ci` e il typecheck anche sui runner Windows e macOS: il lockfile contiene tutte e 20 le varianti con i rispettivi vincoli `os`/`cpu`, comprese `win32-x64`, `darwin-x64` e `darwin-arm64`, quindi ogni runner installa la sua. `tsc --noEmit` passa sulla configurazione esistente senza errori né avvisi; build e test non passano da `tsc` (transpila Vite/esbuild) e restano invariati.
- **GitHub Actions**: `actions/setup-node` 6 → 7, `tauri-apps/tauri-action` 0 → 1. Nessuno degli input rimossi o rinominati dalla v1 (`includeRelease`, `includeDebug`, `assetNamePattern`, `includeUpdaterJson`) è usato da `release.yml`, che passa solo `tagName`, `releaseName`, `releaseBody` e `args`.
- **Rust**: `cargo update` sull'intero albero (125 crate), tra cui `tauri-plugin-single-instance` 2.4.3 → 2.4.4.

### Tecnico
- `dependabot.yml`: gli aggiornamenti sono ora raggruppati. I pacchetti `@tanstack/*` hanno un gruppo dedicato, perché si pinnano a vicenda e in PR separate producono un albero incoerente — è esattamente ciò che ha rotto la build desktop in 2.0.2; il resto di minor e patch arriva in un'unica PR, mentre i major restano PR singole da valutare una per una. Il limite di PR aperte npm passa da 5 a 10: era saturo, con due slot occupati dalla coppia Prisma 7 non mergiabile, e questo impediva a Dependabot di proporre una dozzina di aggiornamenti sicuri.
- **L'adapter è configurato con `timestampFormat: 'unixepoch-ms'`, e non è un dettaglio.** Prisma 6 salvava le `DateTime` di SQLite come INTEGER (millisecondi epoch), mentre il default dell'adapter della 7 è `iso8601`, cioè TEXT. Su un database già esistente le righe nuove sarebbero state scritte in un formato diverso dalle vecchie e, poiché SQLite confronta prima per classe di storage e ogni INTEGER risulta minore di qualsiasi TEXT, i filtri per data avrebbero smesso di vedere le righe scritte da Prisma 6: soci con la loro scadenza, presenze, riepilogo mensile. Il database sarebbe rimasto integro, ma l'app ne avrebbe mostrato solo una parte. Riprodotto su un database creato con Prisma 6 e le migrazioni di questo repo: con il default un socio esistente sparisce dall'elenco filtrato per data di iscrizione, con `unixepoch-ms` l'elenco è di nuovo completo.
- Migrazione Prisma verificata end-to-end: un database creato da Prisma 6 con le migrazioni del repo viene riletto dal client aggiornato (soci presenti, filtri per data corretti), le scritture nuove restano INTEGER come le vecchie, e da zero `prisma migrate deploy` più `db:seed` ricreano il database e l'account amministratore.
- `src/routeTree.gen.ts` rigenerato dal nuovo `router-plugin`: cambia solo l'ordine di import e dichiarazioni, ora alfabetico. Nessuna differenza di comportamento.
- Verificato in locale: `npm ci`, `npm audit --audit-level=moderate` (0 vulnerabilità), `prisma generate`, `typecheck`, test 12/12, `build`, `build:tauri` con prerendering completato, `cargo check` e `cargo audit` (0 vulnerabilità; restano solo avvisi informativi su crate non più manutenute della catena GTK, che riguardano il solo Linux e non i target di release).

## [2.0.3] - 2026-08-17

Release correttiva: ripristina la build desktop, rimasta rotta in 2.0.2. Nessuna modifica funzionale né all'interfaccia utente.

### Corretto
- **@tanstack/react-router** riportato da 1.170.25 a 1.170.16. Le versioni dalla 1.170.25 in poi fanno fallire `npm run build:tauri` durante il prerendering SPA con `TypeError: matchedRoutes is not iterable` in `handleServerRoutes`, impedendo la creazione dei pacchetti desktop. Il problema riguarda solo la modalità Tauri: la build web (`npm run build`) non attraversa quel percorso e passava senza errori. Verificato per bisection che la causa è esclusivamente `@tanstack/react-router`, e che il difetto è ancora presente nella 1.170.29, l'ultima patch pubblicata.
- **@tanstack/router-plugin** riportato da 1.168.29 a 1.168.18. Non è coinvolto nella regressione, ma la 1.168.29 dichiara come peer `@tanstack/react-router@^1.170.25`: tenerlo aggiornato con il router bloccato alla 1.170.16 rende l'albero irrisolvibile e fa fallire `npm ci`. I due pacchetti vanno mossi in coppia, quando il bug a monte sarà risolto.

### Tecnico
- La CI ora esegue anche `npm run build:tauri` oltre a `npm run build`. È il passo che mancava: la regressione di 2.0.2 aveva superato typecheck, test e build web, ed è emersa solo durante il workflow di release, a tag già pubblicato.
- Dei tre aggiornamenti di 2.0.2 sopravvive quindi il solo **lucide-react** 1.31.0, confermato funzionante.

### Nota sui pacchetti
- Per la 2.0.2 non è stato pubblicato alcun binario: i tre job di release (Windows, macOS Intel, macOS aarch64) sono falliti tutti nello stesso punto e nessuna GitHub Release è stata creata. La 2.0.3 è la prima versione installabile successiva alla 2.0.1.

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

[Unreleased]: https://github.com/Francy2009/The-Club/compare/v2.0.3...HEAD
[3.0.0]: https://github.com/Francy2009/The-Club/releases/tag/v3.0.0
[2.0.3]: https://github.com/Francy2009/The-Club/releases/tag/v2.0.3
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
