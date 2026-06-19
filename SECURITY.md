# Security Policy

## Supported Scope

This project is a local-first desktop application. Security reports should focus
on the application code in:

- `src/`
- `src-tauri/`
- `prisma/`
- release/build configuration

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that expose credentials,
personal data, database contents, QR tokens, backup files, or destructive reset
paths.

Report privately to the project maintainer with:

- affected file or feature;
- reproduction steps;
- expected impact;
- suggested fix, if available.

If you are publishing a fork, replace this section with a private contact email
or GitHub Security Advisory instructions before making the repository public.

## Sensitive Data

Never commit or share:

- local database files such as `prisma/dev.db`, `*.db`, `*.sqlite`;
- desktop app data files such as `desktop-db.json`;
- exported backup JSON or CSV files;
- `.env` files or local configuration containing secrets;
- screenshots or logs containing member data, QR tokens, usernames, recovery
  questions, or temporary passwords.

Backup files may contain personal data and QR tokens. Store them encrypted and
share them only through trusted channels.

## Local Development Safety

`npm run dev` binds to `127.0.0.1` by default.

The local database reset panel is disabled in normal development. To enable it
intentionally, use:

```bash
npm run dev:reset
```

This command enables both the client-side reset panel and the server-side
development reset handler. Do not expose this mode on a LAN or public network.

## Release Checklist

Before publishing a release or opening the repository:

```bash
npm audit --audit-level=moderate
npm test
npm run typecheck
npm run build
npm run build:tauri
```

Also verify that no local database, backup, export, `.env`, or generated bundle
file is staged for commit. Desktop releases should also include a generated
`src-tauri/Cargo.lock` so Rust dependencies are reproducible.
