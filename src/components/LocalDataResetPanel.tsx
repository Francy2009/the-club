import { useNavigate, useRouter } from '@tanstack/react-router'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { resetLocalDatabaseFn } from '../lib/api'
import { resetExportDirectory } from '../lib/export-preferences'

const RESET_CONFIRMATION_REQUIRED = "RESETTA L'APP"

function hasTauriRuntime() {
  if (typeof window === 'undefined') return false

  return Boolean(
    (window as typeof window & {
      __TAURI__?: {
        core?: {
          invoke?: unknown
        }
      }
    }).__TAURI__?.core?.invoke,
  )
}

export default function LocalDataResetPanel() {
  const router = useRouter()
  const navigate = useNavigate()
  const [isAvailable, setIsAvailable] = useState(
    import.meta.env.MODE === 'tauri' || import.meta.env.VITE_THE_CLUB_ENABLE_DEV_RESET === 'true',
  )
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetConfirmationText, setResetConfirmationText] = useState('')
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (hasTauriRuntime()) {
      setIsAvailable(true)
    }
  }, [])

  if (!isAvailable) return null

  const canResetDesktopData = resetConfirmationText.trim().toUpperCase() === RESET_CONFIRMATION_REQUIRED

  const resetDesktopData = async () => {
    if (resetting || !canResetDesktopData) return

    setResetting(true)
    try {
      await resetLocalDatabaseFn()
      await resetExportDirectory()
      setResetConfirmationText('')
      setConfirmingReset(false)
      await router.invalidate()
      navigate({ to: '/setup', replace: true })
    } finally {
      setResetting(false)
    }
  }

  return (
    <section className="mt-8 flex justify-center">
      <div className="island-shell rise-in w-full max-w-2xl rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/12 text-amber-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="m-0 text-sm font-bold text-[var(--sea-ink)]">Ripristino dati locali</p>
              <p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
                Cancella i dati salvati in questa app e riapre la configurazione iniziale dell'admin.
              </p>
            </div>
          </div>
          {confirmingReset ? (
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[22rem]">
              <label className="grid gap-1.5 text-xs font-bold text-[var(--sea-ink)]">
                Scrivi RESETTA L'APP per cancellare i dati
                <input
                  value={resetConfirmationText}
                  onChange={(event) => setResetConfirmationText(event.target.value)}
                  disabled={resetting}
                  placeholder="RESETTA L'APP"
                  className="rounded-xl border border-red-500/25 bg-white/70 px-3 py-2.5 text-sm font-semibold text-[var(--sea-ink)] outline-none transition focus:border-red-500/60 focus:ring-2 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetConfirmationText('')
                    setConfirmingReset(false)
                  }}
                  disabled={resetting}
                  className="mobile-action inline-flex items-center justify-center rounded-xl border border-[var(--line)] bg-white/40 px-4 py-3 text-sm font-bold text-[var(--sea-ink)] transition hover:-translate-y-0.5 hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-full"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={resetDesktopData}
                  disabled={resetting || !canResetDesktopData}
                  className="mobile-action inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500 transition hover:-translate-y-0.5 hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-full"
                >
                  <RotateCcw className="h-4 w-4" />
                  {resetting ? 'Ripristino...' : 'Conferma reset'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="mobile-action inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500 transition hover:-translate-y-0.5 hover:bg-red-500/18 sm:w-auto sm:rounded-full"
            >
              <RotateCcw className="h-4 w-4" />
              Reset app
            </button>
          )}
        </div>
        {confirmingReset ? (
          <p className="m-0 mt-4 rounded-xl border border-red-500/15 bg-red-500/8 px-3 py-2 text-xs font-semibold leading-5 text-red-500">
            Verranno cancellati soci, presenze, account e preferenze export salvati da questa app.
          </p>
        ) : null}
      </div>
    </section>
  )
}
