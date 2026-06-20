import { BellRing, ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { checkForAvailableUpdate, getCurrentAppVersion, isTauriRuntime } from '../lib/update-check'
import type { AppUpdateInfo } from '../lib/update-check'

const LAST_CHECK_KEY = 'gestore-pub-update-last-check'
const DISMISSED_VERSION_KEY = 'gestore-pub-update-dismissed-version'
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 5000

export default function UpdateNotice() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!isTauriRuntime()) return undefined

    const timer = window.setTimeout(() => {
      void checkUpdate()
    }, FIRST_CHECK_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [])

  if (hidden || !update) return null

  const dismissUpdate = () => {
    localStorage.setItem(DISMISSED_VERSION_KEY, update.tagName)
    setHidden(true)
  }

  return (
    <section className="border-b border-[var(--line)] bg-[var(--surface-strong)] px-3 py-3">
      <div className="page-wrap flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--coral)]">
            <BellRing className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-sm font-extrabold text-[var(--sea-ink)]">
              Nuova versione disponibile: {update.tagName}
            </p>
            <p className="m-0 mt-1 text-xs leading-5 text-[var(--sea-ink-soft)]">
              Stai usando la versione {getCurrentAppVersion()}. Puoi scaricare l'aggiornamento dalla pagina ufficiale GitHub Releases.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={update.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="mobile-action inline-flex items-center justify-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-xs font-extrabold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:bg-[var(--link-bg-hover)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Apri release
          </a>
          <button
            type="button"
            onClick={dismissUpdate}
            aria-label="Nascondi avviso aggiornamento"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] bg-white/40 text-[var(--sea-ink-soft)] transition hover:bg-white/70 hover:text-[var(--sea-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  )

  async function checkUpdate() {
    try {
      const lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) ?? '0')
      if (Number.isFinite(lastCheck) && Date.now() - lastCheck < CHECK_INTERVAL_MS) return

      const availableUpdate = await checkForAvailableUpdate()
      localStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
      if (!availableUpdate) return
      if (localStorage.getItem(DISMISSED_VERSION_KEY) === availableUpdate.tagName) return

      setUpdate(availableUpdate)
    } catch (error) {
      console.warn('Controllo aggiornamenti non riuscito:', error)
    }
  }
}
