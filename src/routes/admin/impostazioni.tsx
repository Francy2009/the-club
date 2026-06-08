import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  Download,
  FileArchive,
  FileSpreadsheet,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { changeAdminPasswordFn, exportBackupFn, restoreBackupFn } from '../../lib/api'

const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024

export const Route = createFileRoute('/admin/impostazioni')({
  beforeLoad: async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw redirect({ to: '/', replace: true })
    }
  },
  component: AdminSettings,
})

function fileDateStamp(value = new Date().toISOString()) {
  return value.replace(/[:.]/g, '-').slice(0, 19)
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function AdminSettings() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [restoreConfirm, setRestoreConfirm] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const clearMessages = () => {
    setSuccessMsg(null)
    setErrorMsg(null)
  }

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    clearMessages()

    if (newPassword !== confirmPassword) {
      setErrorMsg('Le nuove password non coincidono.')
      return
    }

    setBusyAction('password')
    try {
      await changeAdminPasswordFn({
        data: {
          current_password: currentPassword,
          new_password: newPassword,
        },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMsg('Password amministratore aggiornata. Le sessioni precedenti sono state chiuse.')
      await router.invalidate()
    } catch (error: any) {
      setErrorMsg(error?.message || 'Errore durante il cambio password.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDownloadBackup = async () => {
    clearMessages()
    setBusyAction('backup')
    try {
      const archive = await exportBackupFn()
      const stamp = fileDateStamp(archive.exported_at)
      downloadTextFile(
        `gestore-pub-backup-${stamp}.json`,
        JSON.stringify(archive.backup, null, 2),
        'application/json;charset=utf-8'
      )
      setSuccessMsg(`Backup completo scaricato: ${archive.counts.members} soci e ${archive.counts.attendances} presenze.`)
    } catch (error: any) {
      setErrorMsg(error?.message || 'Errore durante la creazione del backup.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleDownloadCsv = async () => {
    clearMessages()
    setBusyAction('csv')
    try {
      const archive = await exportBackupFn()
      const stamp = fileDateStamp(archive.exported_at)
      downloadTextFile(`gestore-pub-soci-${stamp}.csv`, archive.csv.members, 'text/csv;charset=utf-8')
      downloadTextFile(`gestore-pub-presenze-${stamp}.csv`, archive.csv.attendances, 'text/csv;charset=utf-8')
      setSuccessMsg('Esportazione CSV completata: sono stati scaricati anagrafica soci e storico presenze.')
    } catch (error: any) {
      setErrorMsg(error?.message || 'Errore durante la creazione dei CSV.')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRestoreClick = () => {
    clearMessages()
    if (restoreConfirm !== 'RIPRISTINA') {
      setErrorMsg('Scrivi RIPRISTINA nel campo di conferma prima di caricare un backup.')
      return
    }

    fileInputRef.current?.click()
  }

  const handleRestoreFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    clearMessages()

    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setErrorMsg('Il backup selezionato supera il limite di 20 MB.')
      return
    }

    setBusyAction('restore')
    try {
      const backupText = await file.text()
      const result = await restoreBackupFn({ data: { backup: backupText } })
      setRestoreConfirm('')
      setSuccessMsg(`Backup ripristinato: ${result.restored.members} soci e ${result.restored.attendances} presenze.`)

      if (result.keptSession) {
        await router.invalidate()
      } else {
        await router.navigate({ to: '/login', replace: true })
      }
    } catch (error: any) {
      setErrorMsg(error?.message || 'Errore durante il ripristino del backup.')
    } finally {
      setBusyAction(null)
    }
  }

  const isBusy = busyAction !== null

  return (
    <main className="page-wrap px-4 pb-12 pt-5 sm:pt-8">
      <Link
        to="/admin"
        className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Torna alla Gestione Membri
      </Link>

      <section className="island-shell mb-5 rounded-2xl p-5 sm:mb-8 sm:rounded-[2rem] sm:p-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="island-kicker inline-flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Impostazioni
            </span>
            <h1 className="display-title mt-2 text-3xl font-extrabold tracking-tight text-[var(--sea-ink)] sm:text-4xl">
              Sicurezza, backup e recupero
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-[var(--sea-ink-soft)]">
              Gestisci la password amministratore, scarica una copia completa dei dati e ripristina l'app da un backup quando serve.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] bg-white/30 p-3 text-xs font-bold text-[var(--sea-ink-soft)] dark:bg-white/5">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Admin
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileArchive className="h-4 w-4 text-amber-500" />
              JSON
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-sky-500" />
              CSV
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-rose-500" />
              Restore
            </span>
          </div>
        </div>
      </section>

      {successMsg && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm font-semibold text-emerald-600">
          <Check className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm font-semibold text-red-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]">
        <section className="island-shell rounded-2xl p-5 sm:rounded-[2rem] sm:p-6">
          <div className="relative mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="display-title m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
                Cambia password admin
              </h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
                Valida la password attuale e scegli una nuova chiave robusta.
              </p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="relative grid gap-4">
            <div>
              <label htmlFor="settings-current-password" className="mb-2 block text-xs font-bold uppercase text-[var(--sea-ink-soft)]">
                Password attuale
              </label>
              <input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isBusy}
                required
                className="block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-violet-500/50 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="settings-new-password" className="mb-2 block text-xs font-bold uppercase text-[var(--sea-ink-soft)]">
                  Nuova password
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  disabled={isBusy}
                  required
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-violet-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="settings-confirm-password" className="mb-2 block text-xs font-bold uppercase text-[var(--sea-ink-soft)]">
                  Conferma password
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isBusy}
                  required
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--sea-ink)] focus:border-violet-500/50 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-xs font-semibold leading-relaxed text-violet-700 dark:text-violet-200">
              Minimo 8 caratteri, una maiuscola, un numero e un simbolo. Dopo il salvataggio le vecchie sessioni vengono chiuse.
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="mobile-action inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LockKeyhole className="h-4 w-4" />
              {busyAction === 'password' ? 'Aggiornamento...' : 'Aggiorna password'}
            </button>
          </form>
        </section>

        <section className="island-shell rounded-2xl p-5 sm:rounded-[2rem] sm:p-6">
          <div className="relative mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="display-title m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
                Se resti fuori
              </h2>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
                Sul computer dove gira l'app apri il terminale nella cartella del progetto e lancia:
              </p>
            </div>
          </div>

          <div className="command-stack">
            <div className="command-line">
              <span className="command-line-label">Reset automatico</span>
              <code>npm run db:reset-admin</code>
            </div>

            <div className="command-line">
              <span className="command-line-label">Password scelta</span>
              <code>ADMIN_RESET_PASSWORD=NuovaPass1! npm run db:reset-admin</code>
            </div>
          </div>

          <div className="soft-note mt-4 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
            <p>
              Il comando crea una password temporanea per l'account admin e chiude le sessioni aperte. Al primo accesso l'app chiede di impostare una nuova password.
            </p>
          </div>
        </section>

        <section className="island-shell rounded-2xl p-5 sm:rounded-[2rem] sm:p-6 lg:col-span-2">
          <div className="relative grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                  <Database className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="display-title m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
                    Backup completo
                  </h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
                    Il file JSON e il formato giusto per ripristinare l'app. I CSV servono per consultazione o archiviazione esterna.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isBusy}
                  className="mobile-action inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {busyAction === 'backup' ? 'Creazione...' : 'Scarica backup JSON'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={isBusy}
                  className="mobile-action inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs font-extrabold text-sky-700 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-sky-200"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  {busyAction === 'csv' ? 'Creazione...' : 'Scarica CSV'}
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold leading-relaxed text-amber-700 dark:text-amber-200">
                Il backup contiene hash password e token QR: tienilo su una chiavetta o disco protetto, non in una chat pubblica.
              </div>
            </div>

            <div>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="display-title m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
                    Ripristina backup
                  </h2>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[var(--sea-ink-soft)]">
                    Carica un file JSON generato da questa pagina. Il ripristino sostituisce soci, ruoli e storico presenze.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleRestoreFile}
                className="hidden"
              />

              <label htmlFor="restore-confirm" className="mb-2 block text-xs font-bold uppercase text-[var(--sea-ink-soft)]">
                Conferma ripristino
              </label>
              <input
                id="restore-confirm"
                type="text"
                value={restoreConfirm}
                onChange={(event) => setRestoreConfirm(event.target.value)}
                placeholder="Scrivi RIPRISTINA"
                disabled={isBusy}
                className="block w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm font-bold text-[var(--sea-ink)] focus:border-rose-500/50 focus:outline-none"
              />

              <button
                type="button"
                onClick={handleRestoreClick}
                disabled={isBusy}
                className="mobile-action mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {busyAction === 'restore' ? 'Ripristino...' : 'Carica e ripristina JSON'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
