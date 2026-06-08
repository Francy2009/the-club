# Gestore Pub

Applicazione desktop per la gestione di club privati - membri, presenze, QR code e report.

## 🚀 Avvio Rapido

### Sviluppo (Web + Desktop)

```bash
# Installa dipendenze
npm install

# Avvia server di sviluppo (web su porta 3000)
npm run dev

# In un altro terminale, avvia l'app Tauri
cd src-tauri && cargo tauri dev
```

### Solo Web
```bash
npm run dev
# Apri http://localhost:3000
```

## 📦 Build Produzione

### App Desktop (Tauri) - Multi-piattaforma

I build automatici avvengono via **GitHub Actions** ad ogni tag `v*`:

```bash
# Crea una release
git tag v1.0.0
git push --tags
```

→ Dopo ~2-3 minuti troverai i file scaricabili su:
**https://github.com/FrancescoDellOrto/Gestore-pub/releases**

| Piattaforma | File generati |
|-------------|---------------|
| Windows | `.msi`, `.exe` |
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Linux | `.AppImage`, `.deb` |

### Build Locale (opzionale)

```bash
# Build frontend
npm run build

# Build Tauri per la piattaforma corrente
cd src-tauri && cargo tauri build
```

I file saranno in `src-tauri/target/release/bundle/`.

## 🔄 Aggiornamenti Automatici

L'app controlla automaticamente le nuove versioni all'avvio (Tauri Updater).
Se c'è una nuova release su GitHub, l'utente vedrà un dialog per scaricare e installare.

## 🧪 Testing

```bash
npm run test
```

## 🎨 Styling

Tailwind CSS 4.x - vedi `src/styles.css` e `vite.config.ts`.

## 🗂 Struttura Progetto

```
├── src/                    # Frontend React (TanStack Start)
│   ├── routes/             # File-based routing
│   ├── components/         # Componenti UI
│   └── lib/                # Utilities (auth, db, api)
├── src-tauri/              # Backend Rust (Tauri)
│   ├── src/                # Comandi Tauri, DB, Auth
│   ├── Cargo.toml          # Dipendenze Rust
│   └── tauri.conf.json     # Config Tauri (bundle, updater, icone)
├── prisma/                 # Schema DB + migrazioni + seed
├── .github/workflows/      # CI/CD (release.yml)
├── CHANGELOG.md            # Storico versioni
└── LICENSE                 # MIT License
```

## 🛠 Tech Stack

- **Frontend**: React 19, TanStack Start, TanStack Router, Tailwind CSS 4
- **Backend**: Rust, Tauri 2, SQLx, SQLite
- **Database**: Prisma ORM (schema) + SQLx (runtime)
- **Auth**: JWT + bcrypt + Argon2
- **Build**: Vite, cargo-tauri
- **CI/CD**: GitHub Actions (tauri-action)

## 📄 Licenza

MIT - vedi [LICENSE](LICENSE)



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Demo files

Files prefixed with `demo` can be safely deleted. They are there to provide a starting point for you to play around with the features you've installed.

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
