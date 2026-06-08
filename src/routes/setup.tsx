import { createFileRoute, useNavigate, useRouter, useRouteContext } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { setupValidator } from '../lib/api'
import { Lock, ShieldCheck, ShieldAlert, Check, X, User } from 'lucide-react'
import { z } from 'zod'

export const Route = createFileRoute('/setup')({
  component: Setup,
  beforeLoad: async ({ context }) => {
    // If not logged in, redirect to login
    if (!context.user) {
      throw Route.navigate({ to: '/login', replace: true })
    }
  },
})

// Client-side Zod validation
const passwordSchema = z.string()
  .min(8, 'Almeno 8 caratteri')
  .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
  .regex(/\d/, 'Almeno un numero')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Almeno un simbolo speciale');

function Setup() {
  const { user } = useRouteContext({ from: '__root__' })
  const [username, setUsername] = useState(user?.username || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const navigate = useNavigate()

  // Live checks
  const hasMinLen = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNum = /\d/.test(password)
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  const matchesConfirm = password === confirmPassword && password.length > 0

  const canSubmit = hasMinLen && hasUpper && hasNum && hasSymbol && matchesConfirm && username.trim().length >= 3

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!canSubmit) {
      setError('La password non rispetta i requisiti di sicurezza o le password non coincidono.')
      return
    }

    setLoading(true)

    try {
      const res = await setupValidator({
        data: {
          username: username.trim(),
          password: password,
        },
      })

      if (res.success) {
        // Invalidate router context so the app fetches the updated user object
        await router.invalidate()
        
        // Wait and fetch updated user state
        const updatedContext = await router.load()
        const role = updatedContext?.context?.user?.role

        if (role === 'admin') {
          navigate({ to: '/admin', replace: true })
        } else {
          navigate({ to: '/profile', replace: true })
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Errore durante la configurazione dell\'account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap flex min-h-[80vh] items-center justify-center py-6 sm:px-4 sm:py-12">
      <section className="island-shell rise-in w-full max-w-xl rounded-2xl p-5 sm:rounded-3xl sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="display-title text-center text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)]">
            Configura il tuo Account
          </h1>
          <p className="text-sm text-[var(--sea-ink-soft)] mt-1 text-center">
            Per motivi di sicurezza, devi impostare un nuovo username e una password robusta per il primo accesso.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-500">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
            >
              Scegli il tuo Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                <User className="h-4.5 w-4.5" />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="il_tuo_username"
                required
                disabled={loading}
                className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] focus:border-amber-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-500/10"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Nuova Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    disabled={loading}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] focus:border-amber-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-500/10"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Conferma Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    disabled={loading}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] focus:border-amber-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-500/10"
                  />
                </div>
              </div>
            </div>

            {/* Checklist Box */}
            <div className="flex flex-col justify-center rounded-2xl border border-[var(--line)] bg-white/20 p-4 sm:p-5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--sea-ink)] mb-3 block">
                Requisiti Password:
              </span>
              <ul className="space-y-2 text-xs font-semibold text-[var(--sea-ink-soft)]">
                <li className="flex items-center gap-2">
                  {hasMinLen ? (
                    <span className="text-emerald-500 inline-flex items-center"><Check className="w-4 h-4" /></span>
                  ) : (
                    <span className="text-red-500 inline-flex items-center"><X className="w-4 h-4" /></span>
                  )}
                  Minimo 8 caratteri
                </li>
                <li className="flex items-center gap-2">
                  {hasUpper ? (
                    <span className="text-emerald-500 inline-flex items-center"><Check className="w-4 h-4" /></span>
                  ) : (
                    <span className="text-red-500 inline-flex items-center"><X className="w-4 h-4" /></span>
                  )}
                  Almeno una lettera maiuscola
                </li>
                <li className="flex items-center gap-2">
                  {hasNum ? (
                    <span className="text-emerald-500 inline-flex items-center"><Check className="w-4 h-4" /></span>
                  ) : (
                    <span className="text-red-500 inline-flex items-center"><X className="w-4 h-4" /></span>
                  )}
                  Almeno un numero
                </li>
                <li className="flex items-center gap-2">
                  {hasSymbol ? (
                    <span className="text-emerald-500 inline-flex items-center"><Check className="w-4 h-4" /></span>
                  ) : (
                    <span className="text-red-500 inline-flex items-center"><X className="w-4 h-4" /></span>
                  )}
                  Almeno un simbolo speciale
                </li>
                <li className="flex items-center gap-2 border-t border-[var(--line)] pt-2 mt-2">
                  {matchesConfirm ? (
                    <span className="text-emerald-500 inline-flex items-center"><Check className="w-4 h-4" /></span>
                  ) : (
                    <span className="text-red-500 inline-flex items-center"><X className="w-4 h-4" /></span>
                  )}
                  Le password coincidono
                </li>
              </ul>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="mobile-action flex w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? 'Salvataggio...' : 'Salva e Accedi'}
          </button>
        </form>
      </section>
    </main>
  )
}
