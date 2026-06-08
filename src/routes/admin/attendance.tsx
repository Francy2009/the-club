import { createFileRoute, Link, useRouter, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { getTodayAttendanceFn, deleteAttendanceFn } from '../../lib/api'
import { ArrowLeft, Clock, Search, Trash2, CheckCircle, BarChart3, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/attendance')({
  loader: async () => {
    try {
      return await getTodayAttendanceFn()
    } catch (e: any) {
      throw new Error(e?.message || 'Impossibile caricare i log presenze.')
    }
  },
  component: AttendanceSummary,
})

function AttendanceSummary() {
  const attendances = useLoaderData({ from: '/admin/attendance' })
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const router = useRouter()

  // Filter logs based on search term
  const filteredLogs = attendances.filter((log) => {
    const term = searchTerm.toLowerCase()
    return (
      log.member.first_name.toLowerCase().includes(term) ||
      log.member.last_name.toLowerCase().includes(term) ||
      log.member.member_number.toLowerCase().includes(term) ||
      (log.member.deleted && 'socio cancellato'.includes(term))
    )
  })

  // Handle check-in cancellation
  const handleDelete = async (attendanceId: string, memberName: string) => {
    if (confirm(`Annullare la presenza odierna registrata per ${memberName}?`)) {
      setDeletingId(attendanceId)
      setSuccessMsg(null)
      try {
        await deleteAttendanceFn({ data: { attendance_id: attendanceId } })
        setSuccessMsg(`Presenza di ${memberName} annullata con successo.`)
        await router.invalidate()
      } catch (err: any) {
        alert(err?.message || 'Errore durante la cancellazione.')
      } finally {
        setDeletingId(null)
      }
    }
  }

  // Calculate statistics (hourly distribution)
  const hourlyCounts = Array(24).fill(0)
  attendances.forEach((log) => {
    const hour = new Date(log.check_in_time).getHours()
    hourlyCounts[hour]++
  })

  // Find peak hour
  let peakHour = 0
  let peakCount = 0
  hourlyCounts.forEach((count, hour) => {
    if (count > peakCount) {
      peakCount = count
      peakHour = hour
    }
  })

  return (
    <main className="page-wrap pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-8">
      {/* Back Link */}
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)] sm:mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Torna alla Gestione Membri
      </Link>

      <div className="mb-5 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center sm:mb-8 sm:gap-4">
        <div>
          <h1 className="display-title m-0 text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-4xl">
            Riepilogo Presenze Giornaliere
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[var(--sea-ink-soft)]">
            Registro dettagliato di tutti i check-in registrati in data odierna.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-500">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats Summary Cards */}
      <section className="mb-5 grid gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 sm:h-12 sm:w-12">
            <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Ingressi Totali</span>
            <span className="text-2xl font-extrabold text-[var(--sea-ink)] mt-0.5 block">{attendances.length}</span>
          </div>
        </div>

        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 sm:h-12 sm:w-12">
            <Clock className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Ora di Picco</span>
            <span className="mt-0.5 block text-lg font-extrabold leading-tight text-[var(--sea-ink)] sm:text-2xl">
              {peakCount > 0 ? `${peakHour}:00 - ${peakHour + 1}:00 (${peakCount} ingr.)` : 'N/D'}
            </span>
          </div>
        </div>

        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:col-span-2 sm:gap-4 sm:p-5 lg:col-span-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 sm:h-12 sm:w-12">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Stato Scanner</span>
            <span className="text-2xl font-extrabold text-emerald-500 mt-0.5 block">Attivo</span>
          </div>
        </div>
      </section>

      {/* Main Logs Table */}
      <section className="island-shell rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="display-title m-0 flex items-center gap-2 text-lg font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-xl">
            <Clock className="w-5 h-5 text-rose-500" />
            Registro Check-In di Oggi
          </h2>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtra per nome o tessera..."
              className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 pl-9 pr-4 text-xs text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
            />
          </div>
        </div>

        <div className="mobile-table-cards overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                <th className="pb-3 pr-2">Nominativo Membro</th>
                <th className="pb-3 px-2">N. Tessera</th>
                <th className="pb-3 px-2">Orario Ingresso</th>
                <th className="pb-3 px-2">Canale</th>
                <th className="pb-3 pl-2 text-right">Annulla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-xs">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isDeleting = deletingId === log.id
                  const formattedTime = new Date(log.check_in_time).toLocaleTimeString('it-IT', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                  const memberName = `${log.member.first_name} ${log.member.last_name}`

                  return (
                    <tr key={log.id} className="hover:bg-stone-500/5 transition">
                      <td data-label="Socio" className="py-3.5 pr-2 font-bold text-[var(--sea-ink)]">
                        {memberName}
                        {log.member.deleted && (
                          <span className="ml-2 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 align-middle text-[10px] font-extrabold text-amber-600">
                            Socio cancellato
                          </span>
                        )}
                      </td>
                      <td data-label="Tessera" className="py-3.5 px-2 text-[var(--sea-ink-soft)] font-semibold">
                        {log.member.member_number}
                      </td>
                      <td data-label="Orario" className="py-3.5 px-2 text-[var(--sea-ink-soft)] font-mono">
                        {formattedTime}
                      </td>
                      <td data-label="Canale" className="py-3.5 px-2">
                        <span className="bg-stone-500/10 text-[var(--sea-ink-soft)] border border-stone-500/10 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          Ingresso Locale
                        </span>
                      </td>
                      <td className="py-3.5 pl-2 text-right">
                        <button
                          onClick={() => handleDelete(log.id, memberName)}
                          disabled={isDeleting}
                          title="Annulla registrazione check-in"
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-500 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="ml-1 text-[10px] font-extrabold sm:hidden">Annulla</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[var(--sea-ink-soft)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 opacity-30 text-amber-500" />
                      <span>Nessuna presenza trovata con i filtri attuali.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
