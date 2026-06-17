import { HeadContent, Scripts, createRootRouteWithContext, redirect, isRedirect } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import DownloadSuccessDialog from '../components/DownloadSuccessDialog'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { getCurrentUserFn } from '../lib/api'

import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

const TanStackDevtoolsShell = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackDevtools }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
        import('@tanstack/react-devtools'),
        import('@tanstack/react-router-devtools'),
      ])

      return {
        default: function TanStackDevtoolsShell() {
          return (
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          )
        },
      }
    })
  : null

export interface RouterContext {
  user: {
    id: string;
    first_name: string;
    last_name: string;
    member_number: string | null;
    qr_token: string | null;
    username: string;
    joined_at: string;
    expiry_date: string | null;
    password_changed: boolean;
    must_setup: boolean;
    role: string;
  } | null;
}

function normalizeUser(value: unknown): RouterContext['user'] {
  if (!value || typeof value !== 'object') return null
  const user = value as Partial<NonNullable<RouterContext['user']>>
  if (
    typeof user.id !== 'string' ||
    typeof user.first_name !== 'string' ||
    typeof user.last_name !== 'string' ||
    typeof user.username !== 'string' ||
    typeof user.joined_at !== 'string' ||
    typeof user.password_changed !== 'boolean' ||
    typeof user.must_setup !== 'boolean' ||
    (user.role !== 'admin' && user.role !== 'user')
  ) {
    return null
  }

  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    member_number: typeof user.member_number === 'string' ? user.member_number : null,
    qr_token: typeof user.qr_token === 'string' ? user.qr_token : null,
    username: user.username,
    joined_at: user.joined_at,
    expiry_date: typeof user.expiry_date === 'string' ? user.expiry_date : null,
    password_changed: user.password_changed,
    must_setup: user.must_setup,
    role: user.role,
  }
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        name: 'theme-color',
        content: '#f43f5e',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Gestore Pub',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
      {
        title: 'Gestore Pub - Club Privato',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
    ],
  }),
  beforeLoad: async ({ location }) => {
    try {
      const user = normalizeUser(await getCurrentUserFn());
      if (user && user.must_setup && location.pathname !== '/setup') {
        throw redirect({ to: '/setup' });
      }
      return { user };
    } catch (e) {
      if (isRedirect(e)) {
        throw e;
      }
      return { user: null };
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!import.meta.env.PROD) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch((error) => {
            console.warn('Service worker cleanup failed:', error)
          })
      }

      if ('caches' in window) {
        caches.keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith('gestore-pub-')).map((key) => caches.delete(key))))
          .catch((error) => {
            console.warn('Cache cleanup failed:', error)
          })
      }

      return
    }

    const canUseServiceWorker =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if ('serviceWorker' in navigator && canUseServiceWorker) {
      let refreshing = false

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })

      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.update()
      }).catch((error) => {
        console.warn('Service worker registration failed:', error)
      })
    }
  }, [])

  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <Header />
        {children}
        <Footer />
        <DownloadSuccessDialog />
        {TanStackDevtoolsShell ? (
          <Suspense fallback={null}>
            <TanStackDevtoolsShell />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
