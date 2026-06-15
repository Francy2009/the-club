import { createFileRoute, Link, useLoaderData } from '@tanstack/react-router'
import { jsPDF } from 'jspdf'
import { getMonthlySummaryFn } from '../../lib/api'
import { savePdfDocument } from '../../lib/export-preferences'
import { AlertTriangle, ArrowLeft, CalendarDays, ClipboardList, Download, FileText, Users } from 'lucide-react'

export const Route = createFileRoute('/admin/riepilogo')({
  loader: async () => {
    try {
      return await getMonthlySummaryFn()
    } catch (e: any) {
      throw new Error(e?.message || 'Impossibile caricare il riepilogo.')
    }
  },
  component: AdminSummary,
  beforeLoad: async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw Route.navigate({ to: '/', replace: true })
    }
  },
})

type MonthlySummary = Awaited<ReturnType<typeof getMonthlySummaryFn>>

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('it-IT')
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

function AdminSummary() {
  const summary = useLoaderData({ from: '/admin/riepilogo' }) as MonthlySummary
  const visibleExpiries = summary.expiry.members.slice(0, 12)
  const visibleEvents = summary.attendance.events.slice(0, 12)

  const drawPdfShell = (doc: jsPDF, title: string, subtitle: string, count: string, label: string) => {
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 14

    doc.setFillColor(239, 68, 68)
    doc.rect(0, 0, pageWidth, 44, 'F')
    doc.setFillColor(234, 179, 8)
    doc.circle(pageWidth - 23, 15, 13, 'F')
    doc.setFillColor(20, 111, 118)
    doc.circle(pageWidth - 9, 37, 19, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(19)
    doc.text('THE CLUB', margin, 16)
    doc.setFontSize(12)
    doc.text(title, margin, 27)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(subtitle, margin, 35)

    doc.setFillColor(255, 255, 255)
    doc.roundedRect(margin, 52, pageWidth - margin * 2, 25, 4, 4, 'F')
    doc.setDrawColor(230, 236, 233)
    doc.roundedRect(margin, 52, pageWidth - margin * 2, 25, 4, 4, 'S')
    doc.setTextColor(23, 58, 64)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text(count, margin + 7, 68)
    doc.setFontSize(9)
    doc.setTextColor(65, 97, 102)
    doc.text(label, margin + 24, 61)
    doc.text(`Generato il ${formatDate(summary.generated_at)}`, margin + 24, 68)
  }

  const downloadExpiryPdf = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const rowHeight = 10
    let y = 91

    const drawHeader = (pageNumber: number) => {
      drawPdfShell(
        doc,
        'Tessere in scadenza',
        `Mese: ${summary.expiry.month_label}`,
        String(summary.expiry.members.length),
        'tessere in scadenza questo mese'
      )
      doc.setTextColor(65, 97, 102)
      doc.setFontSize(8)
      doc.text(`Pagina ${pageNumber}`, pageWidth - margin - 18, pageHeight - 8)
      y = 91
      doc.setFillColor(20, 111, 118)
      doc.roundedRect(margin, y - 6, pageWidth - margin * 2, 9, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('SCADENZA', margin + 4, y)
      doc.text('SOCIO', margin + 38, y)
      doc.text('TESSERA', pageWidth - margin - 36, y)
      y += 8
    }

    drawHeader(1)
    summary.expiry.members.forEach((member, index) => {
      if (y + rowHeight > pageHeight - 16) {
        doc.addPage()
        drawHeader(doc.getNumberOfPages())
      }

      doc.setFillColor(index % 2 === 0 ? 255 : 246, index % 2 === 0 ? 247 : 250, index % 2 === 0 ? 237 : 248)
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, rowHeight, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(239, 68, 68)
      doc.text(formatDate(member.expiry_date), margin + 4, y + 1)
      doc.setTextColor(23, 58, 64)
      doc.text(`${member.first_name} ${member.last_name}`.slice(0, 48), margin + 38, y + 1)
      doc.setTextColor(20, 111, 118)
      doc.text(member.member_number, pageWidth - margin - 36, y + 1)
      y += rowHeight
    })

    if (summary.expiry.members.length === 0) {
      doc.setTextColor(65, 97, 102)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text('Nessuna tessera in scadenza questo mese.', margin, y + 8)
    }

    await savePdfDocument(doc, `tessere-in-scadenza-${summary.expiry.month_key}.pdf`)
  }

  const downloadAttendancePdf = async () => {
    if (!summary.attendance.is_closed) return

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    let y = 91

    const drawHeader = (pageNumber: number) => {
      drawPdfShell(
        doc,
        'Riepilogo eventi e presenze',
        `Mese chiuso: ${summary.attendance.month_label}`,
        String(summary.attendance.total_attendances),
        `${summary.attendance.events.length} eventi/giornate registrate`
      )
      doc.setTextColor(65, 97, 102)
      doc.setFontSize(8)
      doc.text(`Pagina ${pageNumber}`, pageWidth - margin - 18, pageHeight - 8)
      y = 91
    }

    drawHeader(1)

    summary.attendance.events.forEach((event) => {
      if (y + 24 > pageHeight - 16) {
        doc.addPage()
        drawHeader(doc.getNumberOfPages())
      }

      doc.setFillColor(20, 111, 118)
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 10, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`Evento del ${formatDate(`${event.date}T12:00:00`)}`, margin + 4, y + 1)
      doc.text(`${event.attendance_count} presenze`, pageWidth - margin - 35, y + 1)
      y += 12

      event.members.forEach((member, index) => {
        if (y + 9 > pageHeight - 16) {
          doc.addPage()
          drawHeader(doc.getNumberOfPages())
        }

        doc.setFillColor(index % 2 === 0 ? 255 : 246, index % 2 === 0 ? 247 : 250, index % 2 === 0 ? 237 : 248)
        doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 8, 1.5, 1.5, 'F')
        doc.setTextColor(23, 58, 64)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(formatTime(member.check_in_time), margin + 4, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`${member.first_name} ${member.last_name}${member.deleted ? ' (cancellato)' : ''}`.slice(0, 58), margin + 24, y)
        doc.setTextColor(239, 68, 68)
        doc.setFont('helvetica', 'bold')
        doc.text(member.member_number, pageWidth - margin - 34, y)
        y += 8
      })

      y += 4
    })

    if (summary.attendance.events.length === 0) {
      doc.setTextColor(65, 97, 102)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text('Nessuna presenza registrata nel mese precedente.', margin, y + 8)
    }

    await savePdfDocument(doc, `riepilogo-eventi-${summary.attendance.month_key}.pdf`)
  }

  return (
    <main className="page-wrap px-4 pb-12 pt-5 sm:pt-8">
      <Link
        to="/admin"
        className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Torna alla Gestione Membri
      </Link>

      <section className="relative mb-6 overflow-hidden rounded-3xl border border-rose-500/15 bg-[linear-gradient(135deg,rgba(239,68,68,0.16),rgba(234,179,8,0.16),rgba(20,111,118,0.12))] p-5 shadow-xl shadow-rose-500/5 sm:p-8">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
              <FileText className="h-3.5 w-3.5" />
              Riepilogo mensile
            </span>
            <h1 className="display-title mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight text-[var(--sea-ink)] sm:text-5xl">
              Riepilogo operativo
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--sea-ink-soft)]">
              Scarica le tessere in scadenza del mese corrente e il riepilogo eventi del mese precedente, gia concluso.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <article className="island-shell rounded-3xl p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h2 className="display-title mt-4 text-xl font-black text-[var(--sea-ink)]">
                Tessere in scadenza
              </h2>
              <p className="mt-1 text-xs font-semibold text-[var(--sea-ink-soft)]">
                {summary.expiry.month_label}
              </p>
            </div>
            <span className="rounded-full bg-rose-500 px-3 py-1 text-sm font-black text-white">
              {summary.expiry.members.length}
            </span>
          </div>

          <button
            type="button"
            onClick={downloadExpiryPdf}
            className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-500 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-rose-500/20 transition hover:bg-rose-600"
          >
            <Download className="h-4 w-4" />
            Scarica tessere in scadenza
          </button>
        </article>

        <article className="island-shell rounded-3xl p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-600">
                <ClipboardList className="h-5 w-5" />
              </span>
              <h2 className="display-title mt-4 text-xl font-black text-[var(--sea-ink)]">
                Eventi e presenze
              </h2>
              <p className="mt-1 text-xs font-semibold text-[var(--sea-ink-soft)]">
                {summary.attendance.month_label} concluso
              </p>
            </div>
            <span className="rounded-full bg-teal-600 px-3 py-1 text-sm font-black text-white">
              {summary.attendance.total_attendances}
            </span>
          </div>

          <button
            type="button"
            onClick={downloadAttendancePdf}
            disabled={!summary.attendance.is_closed}
            className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-xs font-extrabold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Scarica riepilogo eventi
          </button>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="island-shell rounded-3xl p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="display-title m-0 text-lg font-bold tracking-tight text-[var(--sea-ink)]">Scadenze del mese</h2>
            <CalendarDays className="h-5 w-5 text-rose-500" />
          </div>
          <div className="space-y-2">
            {summary.expiry.members.length > 0 ? visibleExpiries.map((member) => (
              <div key={member.id} className="rounded-xl border border-rose-500/10 bg-rose-500/[0.04] p-3 text-xs">
                <div className="font-bold text-[var(--sea-ink)]">{member.first_name} {member.last_name}</div>
                <div className="mt-1 flex justify-between gap-2 text-[var(--sea-ink-soft)]">
                  <span>{member.member_number}</span>
                  <span className="font-bold text-rose-500">{formatDate(member.expiry_date)}</span>
                </div>
              </div>
            )) : (
              <p className="py-8 text-center text-sm font-medium text-[var(--sea-ink-soft)]">Nessuna tessera in scadenza questo mese.</p>
            )}
            {summary.expiry.members.length > visibleExpiries.length && (
              <div className="rounded-xl border border-rose-500/10 bg-white/30 p-3 text-center text-xs font-bold text-[var(--sea-ink-soft)]">
                +{summary.expiry.members.length - visibleExpiries.length} altre tessere nel PDF completo
              </div>
            )}
          </div>
        </article>

        <article className="island-shell rounded-3xl p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="display-title m-0 text-lg font-bold tracking-tight text-[var(--sea-ink)]">Eventi del mese precedente</h2>
            <Users className="h-5 w-5 text-teal-600" />
          </div>
          <div className="space-y-3">
            {summary.attendance.events.length > 0 ? visibleEvents.map((event) => (
              <div key={event.date} className="rounded-xl border border-teal-500/10 bg-teal-500/[0.04] p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-[var(--sea-ink)]">Evento del {formatDate(`${event.date}T12:00:00`)}</span>
                  <span className="font-black text-teal-600">{event.attendance_count}</span>
                </div>
              </div>
            )) : (
              <p className="py-8 text-center text-sm font-medium text-[var(--sea-ink-soft)]">Nessuna presenza nel mese precedente.</p>
            )}
            {summary.attendance.events.length > visibleEvents.length && (
              <div className="rounded-xl border border-teal-500/10 bg-white/30 p-3 text-center text-xs font-bold text-[var(--sea-ink-soft)]">
                +{summary.attendance.events.length - visibleEvents.length} altre giornate nel PDF completo
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  )
}
