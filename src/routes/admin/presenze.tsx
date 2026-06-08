import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { getAttendanceLogsFn, deleteAttendanceFn } from '../../lib/api'
import { jsPDF } from 'jspdf'
import { ArrowLeft, Search, Trash2, CheckCircle, AlertCircle, CalendarDays, Clock, Users, Download } from 'lucide-react'

export const Route = createFileRoute('/admin/presenze')({
  component: AttendanceHistory,
  beforeLoad: async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw Route.navigate({ to: '/', replace: true })
    }
  },
})

type AttendanceLog = Awaited<ReturnType<typeof getAttendanceLogsFn>>[number]

function getDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function AttendanceHistory() {
  const pageSize = 25
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState(getDateInputValue(today))
  const [searchTerm, setSearchTerm] = useState('')
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const loadLogs = async () => {
    setLoading(true)
    setErrorMsg(null)

    try {
      const result = await getAttendanceLogsFn({
        data: {
          date: selectedDate,
          search: searchTerm,
        },
      })
      setLogs(result)
      setCurrentPage(1)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossibile caricare lo storico presenze.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    loadLogs()
  }

  const handleDownloadPDF = () => {
    const reportDate = new Date(`${selectedDate}T12:00:00`)
    const formattedDate = reportDate.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const rowHeight = 9
    let y = 0

    const drawHeader = (pageNumber: number) => {
      doc.setFillColor(20, 111, 118)
      doc.rect(0, 0, pageWidth, 42, 'F')
      doc.setFillColor(239, 68, 68)
      doc.circle(pageWidth - 22, 14, 12, 'F')
      doc.setFillColor(234, 179, 8)
      doc.circle(pageWidth - 10, 34, 16, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text('THE CLUB', margin, 15)
      doc.setFontSize(12)
      doc.text('Report presenze giornaliere', margin, 25)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(formattedDate, margin, 33)

      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 50, pageWidth - margin * 2, 22, 3, 3, 'F')
      doc.setDrawColor(230, 236, 233)
      doc.roundedRect(margin, 50, pageWidth - margin * 2, 22, 3, 3, 'S')

      doc.setTextColor(23, 58, 64)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text(String(logs.length), margin + 6, 64)
      doc.setFontSize(9)
      doc.setTextColor(65, 97, 102)
      doc.text('presenze registrate', margin + 22, 59)
      doc.text(`${uniqueMembers} soci unici`, margin + 22, 65)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`Pagina ${pageNumber}`, pageWidth - margin - 18, pageHeight - 8)

      y = 84
      doc.setFillColor(239, 68, 68)
      doc.roundedRect(margin, y - 6, pageWidth - margin * 2, 9, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('ORARIO', margin + 4, y)
      doc.text('SOCIO', margin + 36, y)
      doc.text('TESSERA', pageWidth - margin - 34, y)
      y += 7
    }

    drawHeader(1)

    logs.forEach((log, index) => {
      if (y + rowHeight > pageHeight - 16) {
        doc.addPage()
        drawHeader(doc.getNumberOfPages())
      }

      const checkInDate = new Date(log.check_in_time)
      const memberName = `${log.member.first_name} ${log.member.last_name}`
      const displayName = log.member.deleted ? `${memberName} (cancellato)` : memberName
      const isEven = index % 2 === 0

      doc.setFillColor(isEven ? 246 : 255, isEven ? 250 : 255, isEven ? 248 : 255)
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, rowHeight, 1.5, 1.5, 'F')
      doc.setTextColor(23, 58, 64)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(checkInDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), margin + 4, y + 1)
      doc.setFont('helvetica', 'normal')
      doc.text(displayName.slice(0, 48), margin + 36, y + 1)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(239, 68, 68)
      doc.text(log.member.member_number, pageWidth - margin - 34, y + 1)
      y += rowHeight
    })

    if (logs.length === 0) {
      doc.setTextColor(65, 97, 102)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text('Nessuna presenza registrata per il giorno selezionato.', margin, y + 8)
    }

    doc.save(`presenze-${selectedDate}.pdf`)
  }

  const handleDelete = async (attendanceId: string, memberName: string) => {
    if (!confirm(`Annullare la presenza registrata per ${memberName}?`)) return

    setDeletingId(attendanceId)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      await deleteAttendanceFn({ data: { attendance_id: attendanceId } })
      setSuccessMsg(`Presenza di ${memberName} annullata con successo.`)
      await loadLogs()
      await router.invalidate()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Errore durante la cancellazione.')
    } finally {
      setDeletingId(null)
    }
  }

  const uniqueMembers = new Set(logs.map((log) => log.member.id || `${log.member.first_name}-${log.member.last_name}-${log.member.member_number}`)).size
  const deletedMembersCount = logs.filter((log) => log.member.deleted).length
  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize))
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <main className="page-wrap px-4 pb-12 pt-5 sm:pt-8">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline hover:text-[var(--sea-ink)] mb-6 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Torna alla Gestione Membri
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="display-title m-0 text-2xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-4xl">
            Storico Presenze
          </h1>
          <p className="mt-1 text-sm font-medium text-[var(--sea-ink-soft)]">
            Consulta le presenze salvate nel database per il giorno selezionato.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-500">
          <CheckCircle className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-500">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <section className="grid gap-3 mb-5 sm:mb-8 sm:grid-cols-3 sm:gap-4">
        <div className="island-shell rounded-2xl p-4 flex items-center gap-3 sm:p-5 sm:gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Presenze</span>
            <span className="text-2xl font-extrabold text-[var(--sea-ink)] mt-0.5 block">{logs.length}</span>
          </div>
        </div>

        <div className="island-shell rounded-2xl p-4 flex items-center gap-3 sm:p-5 sm:gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Giorno</span>
            <span className="text-lg font-extrabold text-[var(--sea-ink)] mt-0.5 block">
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('it-IT')}
            </span>
          </div>
        </div>

        <div className="island-shell rounded-2xl p-4 flex items-center gap-3 sm:p-5 sm:gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Soci Unici</span>
            <span className="text-2xl font-extrabold text-[var(--sea-ink)] mt-0.5 block">{uniqueMembers}</span>
            {deletedMembersCount > 0 && (
              <span className="mt-1 block text-[10px] font-bold text-amber-600">
                {deletedMembersCount} presenza/e di soci cancellati
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="island-shell rounded-3xl p-4 sm:rounded-[2rem] sm:p-6">
        <form onSubmit={handleSubmit} className="mb-6 grid gap-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-end">
          <div>
            <label htmlFor="selectedDate" className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2">
              Giorno
            </label>
            <input
              id="selectedDate"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 px-3 text-xs text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="attendanceSearch" className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2">
              Cerca socio
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="attendanceSearch"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, cognome o tessera..."
                className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 pl-9 pr-4 text-xs text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-xl bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600 disabled:opacity-50"
          >
            {loading ? 'Caricamento...' : 'Cerca'}
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={loading}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            PDF
          </button>
        </form>

        <div className="mobile-table-cards overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                <th className="pb-3 pr-2">Data</th>
                <th className="pb-3 px-2">Orario</th>
                <th className="pb-3 px-2">Socio</th>
                <th className="pb-3 px-2">Tessera</th>
                <th className="pb-3 pl-2 text-right">Annulla</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-xs">
              {logs.length > 0 ? (
                paginatedLogs.map((log) => {
                  const memberName = `${log.member.first_name} ${log.member.last_name}`
                  const checkInDate = new Date(log.check_in_time)
                  const isDeleting = deletingId === log.id

                  return (
                    <tr key={log.id} className="hover:bg-stone-500/5 transition">
                      <td data-label="Data" className="py-3.5 pr-2 font-mono text-[var(--sea-ink-soft)]">
                        {checkInDate.toLocaleDateString('it-IT')}
                      </td>
                      <td data-label="Orario" className="py-3.5 px-2 font-mono text-[var(--sea-ink-soft)]">
                        {checkInDate.toLocaleTimeString('it-IT', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td data-label="Socio" className="py-3.5 px-2 font-bold text-[var(--sea-ink)]">
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
                      <td className="py-3.5 pl-2 text-right">
                        <button
                          onClick={() => handleDelete(log.id, memberName)}
                          disabled={isDeleting}
                          title="Annulla registrazione check-in"
                          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                      <span>{loading ? 'Caricamento presenze...' : 'Nessuna presenza trovata.'}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {logs.length > pageSize && (
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--line)] pt-4 text-xs font-semibold text-[var(--sea-ink-soft)] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrate {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, logs.length)} di {logs.length} presenze
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="cursor-pointer rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2 text-xs font-bold text-[var(--sea-ink)] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Precedenti
              </button>
              <span className="rounded-xl bg-stone-500/10 px-3 py-2 text-[11px] font-black text-[var(--sea-ink)]">
                {currentPage}/{totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="cursor-pointer rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2 text-xs font-bold text-[var(--sea-ink)] transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Successive
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--sea-ink-soft)]">
          <Clock className="h-3.5 w-3.5" />
          Le presenze sono persistenti: restano salvate nel database anche nei giorni successivi.
        </div>
      </section>
    </main>
  )
}
