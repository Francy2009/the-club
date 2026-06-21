# Sicurezza

## Segnalare una vulnerabilità

Se trovi un problema di sicurezza, **non aprire una issue pubblica**. Scrivimi in privato tramite il mio profilo GitHub o, se abilitata, usa la segnalazione privata di vulnerabilità di GitHub.

Indica se possibile:
- quale file o funzione è coinvolto
- come riprodurre il problema
- l'impatto che potrebbe avere
- una fix, se hai un'idea

Risponderò appena posso e ti darò credito nella release che risolve il problema, se vuoi.

## Dati sensibili

Non committare mai nel repository (e non condividere pubblicamente):

- file del database locale (`prisma/dev.db`, `*.db`, `*.sqlite`)
- file dati dell'app desktop (`desktop-db.json`)
- backup esportati (JSON o CSV)
- file `.env` o configurazione con segreti
- screenshot o log che contengono nomi dei soci, token QR, username, password temporanee

I backup contengono dati personali e token QR. Conservali cifrati e non mandarli in chat pubbliche o email non protette.

## Sviluppo locale

`npm run dev` resta in ascolto su `127.0.0.1` — non è raggiungibile dalla rete.

Il pannello di reset del database è disattivato di default. Per attivarlo serve esplicitamente:

```bash
npm run dev:reset
```

Non usarlo su reti condivise: abilita una funzione che cancella tutti i dati locali.

## Prima di una release

```bash
npm audit --audit-level=moderate
npm test
npm run typecheck
npm run build
npm run build:tauri
```

Verifica anche che nessun file locale (database, backup, `.env`, bundle generato) sia stato aggiunto al commit.
