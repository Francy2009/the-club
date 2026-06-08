import { Link, useRouteContext, useRouter } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { logoutFn } from '../lib/api'
import { FileText, Home, LogOut, Shield, User, QrCode, ClipboardList, LogIn, CalendarCheck, Settings } from 'lucide-react'

export default function Header() {
  const { user } = useRouteContext({ from: '__root__' })
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await logoutFn()
      // Invalidate the router matches to trigger page reload/re-fetching of beforeLoad
      await router.invalidate()
      router.navigate({ to: '/login' })
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-2 backdrop-blur-lg sm:px-4">
      <nav className="page-wrap flex flex-wrap items-center gap-x-2 gap-y-2 py-2.5 sm:gap-x-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(90deg,#ef4444,#eab308)]" />
            <span className="font-bold tracking-wider uppercase text-xs">The Club</span>
          </Link>
        </h2>

        <div className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold [-webkit-overflow-scrolling:touch] sm:order-none sm:w-auto sm:flex-nowrap sm:gap-x-4 sm:overflow-visible sm:pb-0 sm:text-sm">
          <Link
            to="/"
            className="nav-link inline-flex shrink-0 items-center gap-1"
            activeProps={{ className: 'nav-link is-active' }}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>

          {user && user.role === 'admin' && (
            <>
              <Link
                to="/admin"
                className="nav-link inline-flex shrink-0 items-center gap-1"
                activeProps={{ className: 'nav-link is-active' }}
                activeOptions={{ exact: true }}
              >
                <ClipboardList className="w-4 h-4" />
                Membri
              </Link>
              <Link
                to="/admin/scanner"
                className="nav-link inline-flex shrink-0 items-center gap-1"
                activeProps={{ className: 'nav-link is-active' }}
              >
                <QrCode className="w-4 h-4" />
                Scanner
              </Link>
              <Link
                to="/admin/presenze"
                className="nav-link inline-flex shrink-0 items-center gap-1"
                activeProps={{ className: 'nav-link is-active' }}
              >
                <CalendarCheck className="w-4 h-4" />
                Presenze
              </Link>
              <Link
                to="/admin/riepilogo"
                className="nav-link inline-flex shrink-0 items-center gap-1"
                activeProps={{ className: 'nav-link is-active' }}
              >
                <FileText className="w-4 h-4" />
                Riepilogo
              </Link>
              <Link
                to="/admin/impostazioni"
                className="nav-link inline-flex shrink-0 items-center gap-1"
                activeProps={{ className: 'nav-link is-active' }}
              >
                <Settings className="w-4 h-4" />
                Impostazioni
              </Link>
            </>
          )}

          {user && user.role === 'user' && (
            <Link
              to="/profile"
              className="nav-link inline-flex shrink-0 items-center gap-1"
              activeProps={{ className: 'nav-link is-active' }}
            >
              <User className="w-4 h-4" />
              La Mia Tessera
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-[var(--sea-ink-soft)] font-medium sm:inline-flex items-center gap-1 rounded-md bg-stone-500/10 px-2 py-1">
                {user.role === 'admin' ? (
                  <Shield className="w-3 h-3 text-red-500" />
                ) : (
                  <User className="w-3 h-3 text-emerald-500" />
                )}
                {user.first_name} {user.last_name}
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1 cursor-pointer rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Esci</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-[var(--link-bg-hover)]"
            >
              <LogIn className="w-3.5 h-3.5" />
              Accedi
            </Link>
          )}

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
