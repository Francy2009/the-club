import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { createMemberFn } from '../../lib/api'
import { savePdfDocument } from '../../lib/export-preferences'
import { QRCodeCanvas } from 'qrcode.react'
import { jsPDF } from 'jspdf'
import { UserPlus, ShieldAlert, ArrowLeft, Download, Award, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/admin/create')({
  component: CreateMember,
  beforeLoad: async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw Route.navigate({ to: '/', replace: true })
    }
  },
})

function CreateMember() {
  const getTodayInputValue = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [memberNumber, setMemberNumber] = useState('')
  const [startDate, setStartDate] = useState(getTodayInputValue)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  
  // Credentials and ID state for PDF generation
  const [createdMember, setCreatedMember] = useState<{
    id: string
    first_name: string
    last_name: string
    member_number: string
    qr_token: string
    joined_at: string
    expiry_date: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await createMemberFn({
        data: {
          first_name: firstName,
          last_name: lastName,
          member_number: memberNumber,
          start_date: startDate,
        },
      })

      if (res.success) {
        setCreatedMember({
          id: res.id!,
          first_name: res.first_name!,
          last_name: res.last_name!,
          member_number: res.member_number!,
          qr_token: res.qr_token!,
          joined_at: res.joined_at!,
          expiry_date: res.expiry_date!,
        })
        // Clear form fields
        setFirstName('')
        setLastName('')
        setMemberNumber('')
        setStartDate(getTodayInputValue())
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        })
      }
    } catch (err: any) {
      setError(err?.message || 'Errore durante la creazione del membro.')
    } finally {
      setLoading(false)
    }
  }

  // Generate and Download PDF Tessera (CR80 Credit Card dimensions: 85mm x 55mm)
  const handleDownloadPDF = async () => {
    if (!createdMember) return
    setPdfDownloading(true)

    try {
      const canvas = document.getElementById('member-qr-canvas') as HTMLCanvasElement
      if (!canvas) {
        alert('Impossibile caricare il codice QR.')
        return
      }

      const qrDataUrl = canvas.toDataURL('image/png')

      // Create PDF in landscape orientation with exact credit-card dimensions (85 x 55 mm)
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [85, 55]
      })

      // 1. Draw cheerful card background
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

      // 2. Draw branding header
      doc.setFillColor(239, 68, 68)
      doc.roundedRect(8, 8, 31, 7, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('THE CLUB', 10, 12.8)

      // 3. Draw member name and card number
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(23, 58, 64)
      doc.setFontSize(9)
      doc.text('Tessera Socio', 8, 22)

      doc.setFontSize(7)
      doc.setTextColor(65, 97, 102)
      doc.text(`${createdMember.first_name.toUpperCase()} ${createdMember.last_name.toUpperCase()}`, 8, 28)
      doc.setTextColor(239, 68, 68)
      doc.text(`N. ${createdMember.member_number}`, 8, 34)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(4.8)
      doc.setTextColor(65, 97, 102)
      doc.text(`Valida dal ${new Date(createdMember.joined_at).toLocaleDateString('it-IT')}`, 8, 39)
      doc.text(`Scade il ${new Date(createdMember.expiry_date).toLocaleDateString('it-IT')}`, 8, 42.5)

      // 4. Add QR Code Image with a clean white quiet zone for reliable scanning.
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(48, 10, 29, 29, 3, 3, 'F')
      doc.setDrawColor(234, 179, 8)
      doc.setLineWidth(0.8)
      doc.roundedRect(48, 10, 29, 29, 3, 3, 'S')
      doc.addImage(qrDataUrl, 'PNG', 50, 12, 25, 25)

      // 5. Footer small description
      doc.text('QR personale statico per check-in ingresso', 8, 45)
      doc.text('Mostrare questa tessera al personale del club', 48, 45)

      // 8. Trigger local download of file
      const fileName = `tessera-${createdMember.first_name.toLowerCase()}-${createdMember.last_name.toLowerCase()}.pdf`
      await savePdfDocument(doc, fileName)
    } catch (e) {
      console.error(e)
      alert('Errore durante la generazione del file PDF.')
    } finally {
      setPdfDownloading(false)
    }
  }

  return (
    <main className="page-wrap pb-6 pt-2 sm:px-4 sm:pb-8 sm:pt-4">
      <div className="mx-auto max-w-lg">
        {/* Back Link */}
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)] sm:mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Torna al Pannello Membri
        </Link>
 
        {createdMember ? (
          /* Tessera Preview and PDF Download Box */
          <section className="island-shell rise-in relative flex flex-col items-center overflow-hidden rounded-2xl border-emerald-500/20 bg-emerald-500/5 p-2 sm:rounded-[2rem] sm:p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="mb-4 flex w-full items-center gap-3 text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="display-title text-lg font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-xl">
                  Socio registrato
                </h2>
                <p className="mt-1 text-xs font-medium leading-normal text-[var(--sea-ink-soft)]">
                  Tessera digitale pronta per il download.
                </p>
              </div>
            </div>
 
            {/* Compact tessera preview. The printable QR stays only inside the generated PDF. */}
            <div className="relative mb-3 flex min-h-40 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-tr from-emerald-600/90 to-teal-800/90 p-4 text-white shadow-xl transition hover:scale-[1.01] sm:min-h-44 sm:p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="flex min-h-0 w-full flex-col justify-between">
                {/* Brand Header */}
                <div className="flex flex-col">
                  <span className="font-bold tracking-wider text-xs uppercase text-emerald-300">The Club</span>
                  <span className="text-[9px] text-white/70 tracking-widest uppercase mt-0.5">Tessera Ufficiale Socio</span>
                </div>

                {/* Member Name and Card Number */}
                <div className="flex flex-col py-5">
                  <span className="text-base font-bold uppercase leading-tight tracking-wide text-white truncate sm:text-lg">
                    {createdMember.first_name} {createdMember.last_name}
                  </span>
                  <span className="text-[11px] font-mono mt-1 text-emerald-200 font-semibold tracking-wider">
                    N. TESSERA: {createdMember.member_number}
                  </span>
                  <span className="mt-2 text-[10px] font-semibold text-white/75">
                    Valida dal {new Date(createdMember.joined_at).toLocaleDateString('it-IT')} al {new Date(createdMember.expiry_date).toLocaleDateString('it-IT')}
                  </span>
                </div>

                {/* Footer status dot */}
                <div className="flex items-center gap-1.5 border-t border-white/10 pt-2 text-[9px] text-white/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>PDF con QR pronto</span>
                </div>
              </div>
            </div>
 
            {/* Hidden/Helper canvas to draw the high-resolution QR Code base64 image for jsPDF */}
            <div className="absolute top-0 left-0 opacity-0 pointer-events-none -z-50">
              <QRCodeCanvas 
                id="member-qr-canvas"
                value={createdMember.qr_token || createdMember.id} 
                size={512}
                fgColor="#0f1a1e"
                bgColor="#ffffff"
                level="H"
                includeMargin
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <button
                onClick={handleDownloadPDF}
                disabled={pdfDownloading}
                className="mobile-action flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-xs font-extrabold text-emerald-600 transition hover:bg-emerald-500/25 disabled:opacity-50"
              >
                <Download className="w-4 h-4 animate-bounce" />
                {pdfDownloading ? 'Generazione...' : 'Scarica Tessera PDF'}
              </button>
              
              <button
                onClick={() => setCreatedMember(null)}
                className="mobile-action flex flex-1 cursor-pointer items-center justify-center rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600"
              >
                Nuova Registrazione
              </button>
            </div>

            <p className="mt-2 w-full rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs font-semibold leading-relaxed text-emerald-600">
              Il PDF contiene il QR Code ed è pronto per essere stampato o inviato al socio.
            </p>
          </section>
        ) : (
          /* Create Form */
          <section className="island-shell rise-in rounded-2xl p-4 sm:rounded-[2rem] sm:p-10">
            <div className="mb-6 flex flex-col items-center sm:mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-3">
                <UserPlus className="h-6 w-6" />
              </div>
              <h1 className="display-title text-center text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)]">
                Registra Nuovo Socio
              </h1>
              <p className="text-sm text-[var(--sea-ink-soft)] mt-1 text-center font-medium">
                Inserisci i dati per generare la tessera d'ingresso.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Nome
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="es. Mario"
                  required
                  disabled={loading}
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 px-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Cognome
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="es. Rossi"
                  required
                  disabled={loading}
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 px-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="memberNumber"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Numero Tessera (Univoco)
                </label>
                <input
                  id="memberNumber"
                  type="text"
                  value={memberNumber}
                  onChange={(e) => setMemberNumber(e.target.value)}
                  placeholder="es. M-1002"
                  required
                  disabled={loading}
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 px-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="startDate"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--sea-ink-soft)] mb-2"
                >
                  Data Inizio Tessera
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={loading}
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-3 px-4 text-sm text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
                <p className="mt-2 text-[11px] font-medium leading-relaxed text-[var(--sea-ink-soft)]">
                  La scadenza annuale verrà calcolata partendo da questa data.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mobile-action flex w-full cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/20 transition hover:brightness-105 active:scale-[0.98]"
              >
                {loading ? 'Registrazione...' : 'Registra Socio e Genera Tessera'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  )
}
