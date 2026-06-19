import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { loginFn, recoverPasswordFn } from '../lib/api'
import { KeyRound, ShieldAlert, LogIn, Lock, User } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const [mode, setMode] = useState<'login' | 'recovery'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryAnswer, setRecoveryAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await loginFn({
        data: {
          username: username.trim(),
          password: password,
        },
      })

      if (res.success) {
        // Invalidate router context to fetch the logged-in user in root beforeLoad
        await router.invalidate()

        if (res.mustSetup) {
          navigate({ to: '/setup', replace: true })
        } else if (res.role === 'admin') {
          navigate({ to: '/admin', replace: true })
        } else {
          navigate({ to: '/profile', replace: true })
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Si è verificato un errore durante l\'accesso.')
    } finally {
      setLoading(false)
    }
  }

  const navigateToRoleArea = (role: string) => {
    if (role === 'admin') {
      navigate({ to: '/admin', replace: true })
    } else {
      navigate({ to: '/profile', replace: true })
    }
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmNewPassword) {
      setError('Le nuove password non coincidono.')
      return
    }

    setLoading(true)

    try {
      const res = await recoverPasswordFn({
        data: {
          username: username.trim(),
          recovery_answer: recoveryAnswer.trim().replace(/\s+/g, ' '),
          new_password: newPassword,
        },
      })

      if (res.success) {
        await router.invalidate()
        navigateToRoleArea(res.role)
      }
    } catch (err: any) {
      setError(err?.message || 'Errore durante il recupero password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-wrap flex min-h-[70vh] items-center justify-center py-6 sm:px-4 sm:py-12">
      <section className="island-shell rise-in w-full max-w-md rounded-2xl p-5 sm:rounded-3xl sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-3">
            <LogIn className="h-6 w-6" />
          </div>
          <h1 className="display-title text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)]">
            Accedi al Club
          </h1>
          <p className="text-sm text-[var(--sea-ink-soft)] mt-1 text-center">
            {mode === 'login'
              ? 'Inserisci le tue credenziali per accedere alla tua area privata.'
              : 'Inserisci lo username, la risposta personale e scegli una nuova password robusta.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-500">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleSubmit : handleRecoverySubmit} className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
            >
              Nome Utente o Username
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
                placeholder="nome_cognome o admin"
                required
                disabled={loading}
                className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-rose-500/10"
              />
            </div>
          </div>

          {mode === 'login' ? (
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
              >
                Password
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
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-rose-500/10"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
                  Inserisci la risposta personale scelta durante la configurazione per recuperare l'accesso.
                </p>
              </div>

              <div>
                <label
                  htmlFor="recoveryAnswer"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Risposta personale
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                    <KeyRound className="h-4.5 w-4.5" />
                  </span>
                  <input
                    id="recoveryAnswer"
                    type="password"
                    value={recoveryAnswer}
                    onChange={(e) => setRecoveryAnswer(e.target.value)}
                    placeholder="la risposta scelta durante la configurazione"
                    required
                    disabled={loading}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-rose-500/10"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                  >
                    Nuova password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/40 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-rose-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmNewPassword"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                  >
                    Conferma
                  </label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/40 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-rose-500/10"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mobile-action flex w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? 'Verifica in corso...' : mode === 'login' ? 'Accedi' : 'Recupera password'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'recovery' : 'login')
              setError(null)
            }}
            disabled={loading}
            className="w-full cursor-pointer rounded-xl border border-[var(--line)] bg-white/30 px-3 py-2.5 text-xs font-bold text-[var(--sea-ink-soft)] transition hover:bg-white/50 hover:text-[var(--sea-ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === 'login' ? 'Ho dimenticato la password' : 'Torna al login'}
          </button>
        </form>
      </section>
    </main>
  )
}
