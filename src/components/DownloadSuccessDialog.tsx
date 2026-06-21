import { useEffect, useState } from 'react'
import { CheckCircle2, FolderOpen, X } from 'lucide-react'
import {
  DOWNLOAD_SUCCESS_EVENT,
  openSavedFileLocation,
  type SaveResult,
} from '../lib/export-preferences'

type DownloadSuccessDetail = SaveResult & {
  filename: string
}

function locationLabel(download: DownloadSuccessDetail) {
  if (download.directoryName) return download.directoryName
  return download.method === 'folder' ? 'cartella scelta' : 'Download'
}

export default function DownloadSuccessDialog() {
  const [download, setDownload] = useState<DownloadSuccessDetail | null>(null)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    const handleDownloadSuccess = (event: Event) => {
      const detail = (event as CustomEvent<DownloadSuccessDetail>).detail
      if (!detail?.filename) return
      setDownload(detail)
      setOpenError(null)
    }

    window.addEventListener(DOWNLOAD_SUCCESS_EVENT, handleDownloadSuccess)
    return () => window.removeEventListener(DOWNLOAD_SUCCESS_EVENT, handleDownloadSuccess)
  }, [])

  if (!download) return null

  const handleOpenFolder = async () => {
    setOpening(true)
    setOpenError(null)

    try {
      const opened = await openSavedFileLocation(download)
      if (!opened) {
        setOpenError('Da questo ambiente non posso aprire la cartella automaticamente.')
      }
    } catch (error: any) {
      setOpenError(error?.message || 'Impossibile aprire la cartella.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(23,58,64,0.24)] px-4 py-5 backdrop-blur-[2px] sm:items-center">
      <section className="island-shell rise-in w-full max-w-md rounded-2xl p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
        <button
          type="button"
          onClick={() => setDownload(null)}
          className="absolute right-4 top-4 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] bg-white/50 text-[var(--sea-ink-soft)] transition hover:bg-white/80 hover:text-[var(--sea-ink)]"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="display-title text-xl font-bold leading-tight text-[var(--sea-ink)]">
              Download completato
            </h2>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
              Il file è stato salvato in {locationLabel(download)}.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-[11px] font-extrabold uppercase text-emerald-700">
            File salvato
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-[var(--sea-ink)]">
            {download.filename}
          </p>
        </div>

        {openError && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold leading-relaxed text-amber-700">
            {openError}
          </p>
        )}

        <div className={`mt-5 grid gap-2 ${download.canOpenDirectory ? 'sm:grid-cols-2' : ''}`}>
          {download.canOpenDirectory && (
            <button
              type="button"
              onClick={handleOpenFolder}
              disabled={opening}
              className="mobile-action inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FolderOpen className="h-4 w-4" />
              {opening ? 'Apertura...' : 'Apri cartella'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setDownload(null)}
            className="mobile-action inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-xs font-extrabold text-[var(--sea-ink)] transition hover:bg-white/80"
          >
            Chiudi
          </button>
        </div>
      </section>
    </div>
  )
}
