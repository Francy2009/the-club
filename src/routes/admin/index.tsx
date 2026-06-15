import { createFileRoute, Link, useRouter, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { 
  getAllMembersFn, 
  renewMembershipFn, 
  getTodayAttendanceFn, 
  deleteMemberFn
} from '../../lib/api'
import { savePdfDocument } from '../../lib/export-preferences'
import { 
  UserPlus, 
  Search, 
  RotateCcw, 
  Check, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Users, 
  CalendarCheck,
  Trash2,
  Calendar,
  ArrowRight,
  Download,
  KeyRound,
  FileText
} from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    try {
      const members = await getAllMembersFn()
      const todayLogs = await getTodayAttendanceFn()
      return { members, todayLogs }
    } catch (e: any) {
      throw new Error(e?.message || 'Impossibile caricare i dati.')
    }
  },
  component: AdminDashboard,
})

function AdminDashboard() {
  const { members, todayLogs } = useLoaderData({ from: '/admin/' })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring' | 'active'>('all')
  
  // Custom Modal States
  const [showRenewModal, setShowRenewModal] = useState<{ id: string; name: string } | null>(null)
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loadingAction, setLoadingAction] = useState(false)
  
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [qrDownloadMember, setQrDownloadMember] = useState<{
    first_name: string
    last_name: string
    member_number: string
    qr_token: string
  } | null>(null)
  const router = useRouter()

  // Handle member deletion
  const handleDeleteMember = async (memberId: string, name: string) => {
    if (confirm(`Sei sicuro di voler eliminare permanentemente il membro ${name}? Lo storico presenze resterà salvato e verrà indicato come socio cancellato.`)) {
      setLoadingAction(true)
      setSuccessMsg(null)
      setErrorMsg(null)
      try {
        await deleteMemberFn({ data: { member_id: memberId } })
        setSuccessMsg(`Membro ${name} eliminato con successo.`)
        await router.invalidate()
      } catch (err: any) {
        setErrorMsg(err?.message || 'Errore durante l\'eliminazione.')
      } finally {
        setLoadingAction(false)
      }
    }
  }

  const handleDownloadMemberCard = (member: {
    first_name: string
    last_name: string
    member_number: string
    qr_token: string
  }) => {
    setQrDownloadMember(member)

    window.setTimeout(async () => {
      try {
        const canvas = document.getElementById('admin-member-qr-canvas') as HTMLCanvasElement | null
        if (!canvas) {
          alert('Impossibile caricare il codice QR.')
          return
        }

        const qrDataUrl = canvas.toDataURL('image/png')
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [85, 55],
        })

        doc.setFillColor(255, 247, 237)
        doc.rect(0, 0, 85, 55, 'F')
        doc.setFillColor(239, 68, 68)
        doc.circle(7, 8, 12, 'F')
        doc.setFillColor(234, 179, 8)
        doc.circle(77, 48, 16, 'F')
        doc.setFillColor(79, 184, 178)
        doc.roundedRect(4, 4, 77, 47, 4, 4, 'F')
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(6, 6, 73, 43, 3, 3, 'F')

        doc.setFillColor(239, 68, 68)
        doc.roundedRect(8, 8, 31, 7, 2, 2, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.text('THE CLUB', 10, 12.8)

        doc.setTextColor(23, 58, 64)
        doc.setFontSize(9)
        doc.text('Tessera Socio', 8, 22)
        doc.setFontSize(7)
        doc.setTextColor(65, 97, 102)
        doc.text(`${member.first_name} ${member.last_name}`.toUpperCase(), 8, 28)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(239, 68, 68)
        doc.text(`N. ${member.member_number}`, 8, 34)

        doc.setFillColor(255, 255, 255)
        doc.roundedRect(48, 10, 29, 29, 3, 3, 'F')
        doc.setDrawColor(234, 179, 8)
        doc.setLineWidth(0.8)
        doc.roundedRect(48, 10, 29, 29, 3, 3, 'S')
        doc.addImage(qrDataUrl, 'PNG', 50, 12, 25, 25)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(4.8)
        doc.setTextColor(65, 97, 102)
        doc.text('QR personale statico per check-in ingresso', 8, 45)
        doc.text('Mostrare questa tessera al personale del club', 48, 45)

        await savePdfDocument(doc, `tessera-${member.first_name.toLowerCase()}-${member.last_name.toLowerCase()}.pdf`)
      } catch (err) {
        console.error(err)
        alert('Errore durante la generazione della tessera PDF.')
      }
    }, 0)
  }

  // Handle membership renewal submission
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showRenewModal) return

    setLoadingAction(true)
    setSuccessMsg(null)
    setErrorMsg(null)

    try {
      await renewMembershipFn({
        data: {
          member_id: showRenewModal.id,
          start_date: new Date(customStartDate).toISOString(),
        },
      })
      setSuccessMsg(`Abbonamento di ${showRenewModal.name} rinnovato con successo a partire dal ${new Date(customStartDate).toLocaleDateString('it-IT')}!`)
      setShowRenewModal(null)
      await router.invalidate()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Errore durante il rinnovo.')
    } finally {
      setLoadingAction(false)
    }
  }

  // Get status badge styles
  const getStatus = (expiryStr: string) => {
    const expiryDate = new Date(expiryStr)
    const today = new Date()
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        kind: 'expired' as const,
        text: 'Scaduta',
        detail: `Da ${Math.abs(diffDays)} gg`,
        badge: 'border-red-500/20 bg-red-500/10 text-red-500',
        row: 'bg-red-500/[0.035] hover:bg-red-500/[0.07]',
        icon: <XCircle className="w-3.5 h-3.5" />,
      }
    } else if (diffDays <= 30) {
      return {
        kind: 'expiring' as const,
        text: `In Scadenza (${diffDays} gg)`,
        detail: diffDays === 0 ? 'Scade oggi' : `Entro ${diffDays} gg`,
        badge: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
        row: 'bg-amber-500/[0.045] hover:bg-amber-500/[0.09]',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      }
    } else {
      return {
        kind: 'active' as const,
        text: 'Valida',
        detail: `${diffDays} gg rimasti`,
        badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
        row: 'hover:bg-stone-500/5',
        icon: <Check className="w-3.5 h-3.5" />,
      }
    }
  }

  const membersWithStatus = members.map((member) => ({
    ...member,
    status: getStatus(member.expiry_date),
  }))

  const statusCounts = membersWithStatus.reduce(
    (acc, member) => {
      acc[member.status.kind] += 1
      return acc
    },
    { expired: 0, expiring: 0, active: 0 }
  )

  const filteredMembers = membersWithStatus.filter((m) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      m.first_name.toLowerCase().includes(term) ||
      m.last_name.toLowerCase().includes(term) ||
      m.member_number.toLowerCase().includes(term) ||
      m.username.toLowerCase().includes(term)
    const matchesStatus = statusFilter === 'all' || m.status.kind === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <main className="page-wrap relative pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-8">
      {/* Header Overview Card */}
      <section className="mb-5 grid gap-3 sm:mb-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 sm:h-12 sm:w-12">
            <Users className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Membri Totali</span>
            <span className="text-2xl font-extrabold text-[var(--sea-ink)] mt-0.5 block">{members.length}</span>
          </div>
        </div>

        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 sm:h-12 sm:w-12">
            <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-[var(--sea-ink-soft)] font-medium uppercase tracking-wider block">Presenze di Oggi</span>
            <span className="text-2xl font-extrabold text-[var(--sea-ink)] mt-0.5 block">{todayLogs.length}</span>
          </div>
        </div>

        <div className="island-shell flex items-center gap-3 rounded-2xl p-3.5 sm:col-span-2 sm:gap-4 sm:p-5 lg:col-span-1">
          <div className="flex w-full flex-col gap-2">
            <Link
              to="/admin/riepilogo"
              className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-3 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 sm:py-3.5"
            >
              <FileText className="w-4 h-4" />
              Riepilogo Mensile
            </Link>
            <Link
              to="/admin/create"
              className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-3 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600 sm:py-3.5"
            >
              <UserPlus className="w-4 h-4" />
              Aggiungi Nuovo Membro
            </Link>
            <Link
              to="/admin/impostazioni"
              className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-3 text-xs font-bold text-violet-600 no-underline transition hover:bg-violet-500/20"
            >
              <KeyRound className="w-4 h-4" />
              Impostazioni e Backup
            </Link>
          </div>
        </div>
      </section>

      {successMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-500">
          <Check className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-500">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <section className="mb-5 grid gap-3 sm:mb-8 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'expired' ? 'all' : 'expired')}
          className={`group cursor-pointer rounded-2xl border p-4 text-left transition sm:p-5 ${
            statusFilter === 'expired'
              ? 'border-red-500/40 bg-red-500/15 shadow-lg shadow-red-500/10'
              : 'border-red-500/15 bg-red-500/[0.07] hover:bg-red-500/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-white/40 text-red-500">
              <XCircle className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-extrabold text-white">
              {statusCounts.expired}
            </span>
          </div>
          <h3 className="mt-4 text-base font-extrabold text-red-600">Tessere Scadute</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--sea-ink-soft)]">
            Soci da rinnovare prima di poter registrare nuovi ingressi.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}
          className={`group cursor-pointer rounded-2xl border p-4 text-left transition sm:p-5 ${
            statusFilter === 'expiring'
              ? 'border-amber-500/50 bg-amber-500/20 shadow-lg shadow-amber-500/10'
              : 'border-amber-500/15 bg-amber-500/[0.08] hover:bg-amber-500/12'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-white/40 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-extrabold text-white">
              {statusCounts.expiring}
            </span>
          </div>
          <h3 className="mt-4 text-base font-extrabold text-amber-600">In Scadenza</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--sea-ink-soft)]">
            Scadono entro 30 giorni da oggi, non dal mese di calendario.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          className={`group cursor-pointer rounded-2xl border p-4 text-left transition sm:p-5 ${
            statusFilter === 'active'
              ? 'border-emerald-500/40 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
              : 'border-emerald-500/15 bg-emerald-500/[0.07] hover:bg-emerald-500/10'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-white/40 text-emerald-500">
              <Check className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-extrabold text-white">
              {statusCounts.active}
            </span>
          </div>
          <h3 className="mt-4 text-base font-extrabold text-emerald-600">Tessere Valide</h3>
          <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--sea-ink-soft)]">
            Soci attivi con oltre 30 giorni residui prima della scadenza.
          </p>
        </button>
      </section>

      {/* Main Content Split Area */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Members Management Column */}
        <section className="island-shell rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:gap-4 sm:mb-6">
            <div>
              <h2 className="display-title m-0 text-xl font-bold tracking-tight text-[var(--sea-ink)]">
                Anagrafica Membri
              </h2>
              <p className="mt-1 text-xs font-semibold text-[var(--sea-ink-soft)]">
                {statusFilter === 'all'
                  ? `${filteredMembers.length} soci visualizzati`
                  : `${filteredMembers.length} soci filtrati per stato`}
              </p>
            </div>

            {/* Search Input */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2.5 text-xs font-bold text-[var(--sea-ink-soft)] transition hover:bg-white/70"
                >
                  Mostra tutti
                </button>
              )}
              <div className="relative w-full sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cerca per nome, tessera..."
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 pl-9 pr-4 text-xs text-[var(--sea-ink)] focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mobile-table-cards overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                  <th className="pb-3 pr-2">Nominativo</th>
                  <th className="pb-3 px-2 hidden sm:table-cell">Tessera N.</th>
                  <th className="pb-3 px-2">Scadenza</th>
                  <th className="pb-3 px-2">Stato</th>
                  <th className="pb-3 pl-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] text-xs">
                {filteredMembers.length > 0 ? (
                  filteredMembers.map((m) => {
                    const status = m.status
                    const memberName = `${m.first_name} ${m.last_name}`
                    
                    return (
                      <tr key={m.id} className={`transition ${status.row}`}>
                        <td data-label="Socio" className="py-3.5 pr-2 font-bold text-[var(--sea-ink)]">
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5">
                              {status.kind === 'expired' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                              {status.kind === 'expiring' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                              {memberName}
                            </span>
                            <span className="text-[10px] text-[var(--sea-ink-soft)] font-mono sm:hidden mt-0.5">
                              {m.member_number}
                            </span>
                          </div>
                        </td>
                        <td data-label="Tessera" className="py-3.5 px-2 text-[var(--sea-ink-soft)] font-semibold hidden sm:table-cell">
                          {m.member_number}
                        </td>
                        <td data-label="Scadenza" className="py-3.5 px-2 text-[var(--sea-ink-soft)] font-mono">
                          {new Date(m.expiry_date).toLocaleDateString('it-IT')}
                        </td>
                        <td data-label="Stato" className="py-3.5 px-2">
                          <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.badge}`}>
                            {status.icon}
                            {status.text}
                          </span>
                          <span className="mt-1 block text-[10px] font-semibold text-[var(--sea-ink-soft)]">
                            {status.detail}
                          </span>
                        </td>
                        <td className="py-3.5 pl-2 text-right">
                          <div className="inline-flex gap-1.5">
                            {/* Renew Button */}
                            <button
                              onClick={() => {
                                setCustomStartDate(new Date().toISOString().split('T')[0])
                                setShowRenewModal({ id: m.id, name: memberName })
                              }}
                              disabled={loadingAction}
                              title="Rinnova abbonamento"
                              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-500 hover:bg-amber-500/20 transition disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="ml-1 text-[10px] font-extrabold sm:hidden">Rinnova</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDownloadMemberCard(m)}
                              disabled={loadingAction || !m.qr_token}
                              title="Scarica tessera QR"
                              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-sky-600 hover:bg-sky-500/20 transition disabled:opacity-50"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="ml-1 text-[10px] font-extrabold sm:hidden">QR</span>
                            </button>

                            <button
                              onClick={() => handleDeleteMember(m.id, memberName)}
                              disabled={loadingAction}
                              title="Elimina Membro"
                              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-500 hover:bg-red-500/20 transition disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="ml-1 text-[10px] font-extrabold sm:hidden">Elimina</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--sea-ink-soft)]">
                      Nessun membro trovato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Today's Attendance Log Column */}
          <section className="island-shell flex flex-col justify-between rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6">
          <div>
            <div className="mobile-safe-row mb-4 justify-between sm:mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <h2 className="display-title m-0 text-lg font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-xl">
                  Presenze di Oggi
                </h2>
              </div>
              <Link
                to="/admin/presenze"
                className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-500 no-underline hover:underline"
              >
                Vedi Tutti
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
              {todayLogs.length > 0 ? (
                todayLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white/20 p-3.5 transition hover:bg-white/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[var(--sea-ink)]">
                        {log.member.first_name} {log.member.last_name}
                        {log.member.deleted && (
                          <span className="ml-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 align-middle text-[9px] font-extrabold text-amber-600">
                            cancellato
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-[var(--sea-ink-soft)] font-mono mt-0.5">
                        {log.member.member_number}
                      </span>
                    </div>
                    <span className="w-fit rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-600">
                      {new Date(log.check_in_time).toLocaleTimeString('it-IT', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-[var(--sea-ink-soft)]">
                  Nessuna presenza registrata per oggi.
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-6 border-t border-[var(--line)] pt-4">
            <Link
              to="/admin/scanner"
              className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-3 text-center text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600"
            >
              Registra Presenze
            </Link>
          </div>
        </section>
      </div>

      {/* Floating Custom Renewal Modal */}
      {showRenewModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="island-shell rise-in relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl p-5 shadow-2xl sm:rounded-3xl sm:p-8">
            <h3 className="display-title text-xl font-bold tracking-tight text-[var(--sea-ink)] mb-1">
              Rinnova Abbonamento
            </h3>
            <p className="text-xs text-[var(--sea-ink-soft)] mb-6">
              Stai rinnovando l'abbonamento annuale per il membro: <span className="font-bold text-[var(--sea-ink)]">{showRenewModal.name}</span>.
            </p>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Data Decorrenza Rinnovo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                    <Calendar className="h-4.5 w-4.5" />
                  </span>
                  <input
                    id="startDate"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    required
                    disabled={loadingAction}
                    className="block w-full rounded-xl border border-[var(--line)] bg-white/50 py-3 pl-10 pr-4 text-sm text-[var(--sea-ink)] focus:outline-none focus:border-rose-500/50"
                  />
                </div>
              </div>

              {/* Display calculated details */}
              <div className="rounded-xl border border-[var(--line)] bg-white/20 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--sea-ink-soft)]">Nuovo Inizio:</span>
                  <span className="font-bold text-[var(--sea-ink)]">
                    {new Date(customStartDate).toLocaleDateString('it-IT')}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--sea-ink-soft)]">Nuova Scadenza:</span>
                  <span className="font-bold text-rose-500">
                    {new Date(new Date(customStartDate).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(null)}
                  disabled={loadingAction}
                  className="mobile-action flex-1 cursor-pointer rounded-xl border border-[var(--line)] bg-white/40 px-3 py-2.5 text-xs font-bold text-[var(--sea-ink-soft)] transition hover:bg-white/70"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="mobile-action flex-1 cursor-pointer rounded-xl bg-rose-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600"
                >
                  {loadingAction ? 'Salvataggio...' : 'Conferma Rinnovo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {qrDownloadMember && (
        <div className="absolute left-0 top-0 -z-50 opacity-0 pointer-events-none">
          <QRCodeCanvas
            id="admin-member-qr-canvas"
            value={qrDownloadMember.qr_token}
            size={512}
            fgColor="#0f1a1e"
            bgColor="#ffffff"
            level="H"
            includeMargin
          />
        </div>
      )}
    </main>
  )
}
