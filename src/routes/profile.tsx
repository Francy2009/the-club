import { createFileRoute, redirect, useRouteContext, Link } from '@tanstack/react-router'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldAlert, Award, AlertTriangle, ShieldCheck, QrCode, ClipboardList } from 'lucide-react'

export const Route = createFileRoute('/profile')({
  component: Profile,
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login', replace: true })
    }
  },
})

function Profile() {
  const { user } = useRouteContext({ from: '__root__' })

  if (!user) return null

  if (user.role === 'admin') {
    return (
      <main className="page-wrap pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-14">
        <div className="mx-auto max-w-2xl">
          <h1 className="display-title mb-4 text-center text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:mb-6 sm:text-4xl">
            Profilo Amministratore
          </h1>

          <div className="grid gap-6 md:grid-cols-1">
            {/* Admin Profile Card */}
            <section className="island-shell rise-in flex flex-col items-center rounded-2xl p-4 sm:rounded-[2rem] sm:p-10">
              {/* Admin ID Badge */}
              <div className="w-full max-w-md aspect-[1.58] rounded-2xl bg-gradient-to-tr from-slate-800 to-zinc-950 p-5 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between mb-6 border border-white/10 sm:h-56 sm:p-6 sm:mb-8">
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl pointer-events-none" />
                
                {/* Badge Header */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold tracking-wider text-sm uppercase text-rose-500">The Club</span>
                    <span className="text-[10px] text-white/50 tracking-widest uppercase mt-0.5">Console Amministratore</span>
                  </div>
                  <ShieldCheck className="w-8 h-8 text-rose-500" />
                </div>

                {/* Badge Body */}
                <div className="flex min-w-0 flex-col">
                  <span className="text-lg font-bold uppercase leading-tight sm:text-xl">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-xs font-mono mt-1 text-rose-400 tracking-wider font-semibold">
                    ADMINISTRATOR
                  </span>
                </div>

                {/* Badge Footer */}
                <div className="flex justify-between items-end border-t border-white/10 pt-3 text-white/80">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-white/50 uppercase">Accesso</span>
                    <span className="text-xs font-semibold">Sistema Locale</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-white/50 uppercase">Stato</span>
                    <span className="text-xs font-semibold text-emerald-400">Privilegi Completi</span>
                  </div>
                </div>
              </div>

              {/* Admin Info Panel */}
              <div className="relative flex w-full max-w-md flex-col items-center rounded-2xl border border-[var(--line)] bg-white/40 p-4 shadow-inner sm:p-6">
                <ShieldCheck className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
                <span className="text-sm font-bold uppercase tracking-wider text-[var(--sea-ink)] text-center mb-2">
                  Account Amministratore
                </span>
                <p className="text-xs text-[var(--sea-ink-soft)] text-center leading-relaxed max-w-xs mb-6">
                  Questo account dispone di privilegi completi di gestione. Non è richiesta la scansione di una tessera per l'accesso.
                </p>

                {/* Quick actions panel */}
                <div className="w-full border-t border-[var(--line)] pt-4 flex flex-col gap-2">
                  <Link
                    to="/admin/scanner"
                    className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-3 text-center text-xs font-bold text-white no-underline shadow-md shadow-rose-500/20 transition hover:bg-rose-600"
                  >
                    <QrCode className="w-4 h-4" />
                    Apri Scanner Check-In
                  </Link>
                  <Link
                    to="/admin"
                    className="mobile-action inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[rgba(23,58,64,0.2)] bg-white/50 px-3 py-3 text-center text-xs font-bold text-[var(--sea-ink)] no-underline transition hover:bg-white/70"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Pannello di Controllo
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    )
  }

  // Calculate membership status for standard members
  if (!user.expiry_date) return null

  const expiryDate = new Date(user.expiry_date)
  const joinedDate = new Date(user.joined_at)
  const today = new Date()
  const diffTime = expiryDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  let statusColor = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
  let statusText = 'Tessera Valida'
  let cardGradient = 'from-emerald-600/90 to-teal-800/90'
  let statusIcon = <ShieldCheck className="w-5 h-5" />

  if (diffDays < 0) {
    statusColor = 'border-red-500/20 bg-red-500/10 text-red-500'
    statusText = 'Tessera Scaduta'
    cardGradient = 'from-red-600/90 to-rose-800/90'
    statusIcon = <ShieldAlert className="w-5 h-5" />
  } else if (diffDays <= 30) {
    statusColor = 'border-amber-500/20 bg-amber-500/10 text-amber-500'
    statusText = `In Scadenza (${diffDays} gg)`
    cardGradient = 'from-amber-500/90 to-orange-700/90'
    statusIcon = <AlertTriangle className="w-5 h-5" />
  }

  return (
    <main className="page-wrap pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-14">
      <div className="mx-auto max-w-2xl">
        <h1 className="display-title mb-4 text-center text-2xl font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:mb-6 sm:text-4xl">
          La Mia Tessera Club
        </h1>

        <div className="grid gap-6 md:grid-cols-1">
          {/* Tessera Card */}
          <section className="island-shell rise-in flex flex-col items-center rounded-2xl p-4 sm:rounded-[2rem] sm:p-10">
            {/* Real Credit Card layout */}
            <div className={`relative mb-5 flex aspect-[1.58] w-full max-w-md flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-tr ${cardGradient} p-4 text-white shadow-2xl sm:mb-8 sm:h-56 sm:p-6`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl pointer-events-none" />
              
              {/* Card Header */}
              <div className="flex justify-between items-start">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold uppercase tracking-wider">The Club</span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-widest text-white/70">Tessera Personale</span>
                </div>
                <Award className="w-7 h-7 text-white/80" />
              </div>

              {/* Card Body */}
              <div className="flex flex-col">
                <span className="text-lg font-bold uppercase leading-tight sm:text-xl">
                  {user.first_name} {user.last_name}
                </span>
                <span className="text-sm font-mono mt-1 text-white/80">
                  {user.member_number}
                </span>
              </div>

              {/* Card Footer */}
              <div className="flex justify-between items-end border-t border-white/10 pt-3">
                <div className="flex flex-col">
                  <span className="text-[9px] text-white/60 uppercase">Iscritto il</span>
                  <span className="text-xs font-semibold">{joinedDate.toLocaleDateString('it-IT')}</span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] text-white/60 uppercase">Scadenza</span>
                  <span className="text-xs font-semibold">{expiryDate.toLocaleDateString('it-IT')}</span>
                </div>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="relative flex w-full max-w-sm flex-col items-center rounded-2xl border border-[var(--line)] bg-white/40 p-4 shadow-inner sm:p-6">
              <span className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-[var(--sea-ink-soft)]">
                Mostra all'ingresso per il Check-In
              </span>
              
              <div className="flex max-w-full items-center justify-center rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
                <QRCodeSVG 
                  value={user.qr_token || ''} 
                  size={180} 
                  fgColor="#0f1a1e" 
                  bgColor="#ffffff"
                  includeMargin={true}
                />
              </div>

              <div className={`mt-5 flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${statusColor}`}>
                {statusIcon}
                <span>{statusText}</span>
              </div>
            </div>

            <div className="mt-6 max-w-sm text-center text-xs leading-relaxed text-[var(--sea-ink-soft)] sm:mt-8">
              <p>Questa tessera è strettamente personale. Il QR Code contiene un codice dedicato alla tua tessera per l'identificazione all'ingresso.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
