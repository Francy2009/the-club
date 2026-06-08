import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router'
import { Shield, User, QrCode, ClipboardList, PlusCircle, LogIn, Calendar, CheckCircle, CalendarCheck } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const { user } = useRouteContext({ from: '__root__' })

  // Calculate membership status if user is logged in
  let diffDays = 0
  let statusColor = 'text-green-500 bg-green-500/10 border-green-500/20'
  let statusText = 'Valida'

  if (user && user.role !== 'admin' && user.expiry_date) {
    const expiryDate = new Date(user.expiry_date)
    const today = new Date()
    const diffTime = expiryDate.getTime() - today.getTime()
    diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      statusColor = 'text-red-500 bg-red-500/10 border-red-500/20'
      statusText = 'Scaduta'
    } else if (diffDays <= 30) {
      statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20'
      statusText = `In Scadenza (${diffDays} gg)`
    } else {
      statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
      statusText = 'Valida'
    }
  }

  return (
    <main className="page-wrap pb-8 pt-4 sm:px-4 sm:pt-14">
      {/* Hero Welcome Card */}
      <section className="island-shell rise-in relative overflow-hidden rounded-2xl px-5 py-7 sm:rounded-[2rem] sm:px-10 sm:py-16">
        <p className="island-kicker mb-3">Club Privato Locale</p>
        <h1 className="display-title mb-4 max-w-3xl text-[2rem] leading-[1.05] font-bold tracking-tight text-[var(--sea-ink)] sm:mb-5 sm:text-6xl">
          {user ? `Benvenuto, ${user.first_name}!` : 'Benvenuto al Club Privato'}
        </h1>
        <p className="mb-6 max-w-2xl text-sm leading-6 text-[var(--sea-ink-soft)] sm:mb-8 sm:text-lg">
          {user 
            ? 'Gestisci la tua iscrizione, mostra il tuo QR Code all\'ingresso o gestisci le presenze e i membri se sei un amministratore.'
            : 'Questa è l\'applicazione locale per la gestione degli accessi e dei membri del club. Effettua l\'accesso per vedere la tua tessera.'}
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
          {user ? (
            user.role === 'admin' ? (
              <>
                <Link
                  to="/admin/scanner"
                  className="mobile-action inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/20 px-6 py-3 text-sm font-semibold text-rose-500 no-underline transition hover:-translate-y-0.5 hover:bg-rose-500/30 sm:w-auto sm:rounded-full"
                >
                  <QrCode className="w-4 h-4" />
                  Avvia QR Scanner
                </Link>
                <Link
                  to="/admin"
                  className="mobile-action inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(23,58,64,0.2)] bg-white/50 px-6 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)] sm:w-auto sm:rounded-full"
                >
                  <ClipboardList className="w-4 h-4" />
                  Pannello Amministrazione
                </Link>
              </>
            ) : (
              <Link
                to="/profile"
                className="mobile-action inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-500 no-underline transition hover:-translate-y-0.5 hover:bg-emerald-500/30 sm:w-auto sm:rounded-full"
              >
                <QrCode className="w-4 h-4" />
                Visualizza Tessera QR
              </Link>
            )
          ) : (
            <Link
              to="/login"
              className="mobile-action inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(23,58,64,0.2)] bg-white/60 px-6 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)] sm:w-auto sm:rounded-full"
            >
              <LogIn className="w-4 h-4" />
              Accedi con le tue Credenziali
            </Link>
          )}
        </div>
      </section>

      {/* Conditional Dashboard Grids */}
      {user ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight text-[var(--sea-ink)] sm:mb-4 sm:text-xl">
            {user.role === 'admin' ? 'Console di Amministrazione' : 'Panoramica del tuo Account'}
          </h2>

          {user.role === 'admin' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Role Card */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:p-6">
                <span className="island-kicker mb-2 block">Ruolo Utente</span>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-rose-500" />
                    <span className="text-sm text-[var(--sea-ink)] font-bold uppercase tracking-wider">
                      Amministratore
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                    SISTEMA
                  </span>
                </div>
                <p className="mt-4 text-xs text-[var(--sea-ink-soft)] leading-relaxed">
                  Disponi di privilegi completi per gestire l'anagrafica, i rinnovi, stampare le tessere ed effettuare scansioni all'ingresso.
                </p>
              </article>

              {/* Quick Tools Access Card */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:p-6">
                <span className="island-kicker mb-2 block">Strumenti Rapidi</span>
                <div className="mt-2 flex flex-col gap-2">
                  <Link
                    to="/admin"
                    className="w-full text-left inline-flex items-center gap-2 text-xs font-semibold text-[var(--sea-ink)] hover:underline no-underline"
                  >
                    <ClipboardList className="w-4 h-4" />
                    Elenco Iscritti
                  </Link>
                  <Link
                    to="/admin/create"
                    className="w-full text-left inline-flex items-center gap-2 text-xs font-semibold text-[var(--sea-ink)] hover:underline no-underline"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Registra Nuovo Membro
                  </Link>
                  <Link
                    to="/admin/scanner"
                    className="w-full text-left inline-flex items-center gap-2 text-xs font-semibold text-rose-500 hover:underline no-underline"
                  >
                    <QrCode className="w-4 h-4" />
                    Apri Scanner QR
                  </Link>
                  <Link
                    to="/admin/presenze"
                    className="w-full text-left inline-flex items-center gap-2 text-xs font-semibold text-[var(--sea-ink)] hover:underline no-underline"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    Storico Presenze
                  </Link>
                </div>
              </article>

              {/* Local Security & Privacy */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:col-span-2 sm:p-6 lg:col-span-1">
                <span className="island-kicker mb-2 block">Sicurezza & Privacy</span>
                <div className="mt-2 text-sm text-[var(--sea-ink-soft)]">
                  I dati del club sono memorizzati interamente in locale e le credenziali sono protette.
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-xs text-emerald-500 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Connessione Locale Sicura
                </div>
              </article>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Status Card */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:p-6">
                <span className="island-kicker mb-2 block">Stato Abbonamento</span>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[var(--sea-ink-soft)]" />
                    <span className="text-sm text-[var(--sea-ink-soft)] font-medium">Tessera</span>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${statusColor}`}>
                    {statusText}
                  </span>
                </div>
                <p className="mt-4 text-xs text-[var(--sea-ink-soft)]">
                  Scadenza: <span className="font-semibold">{new Date(user.expiry_date).toLocaleDateString('it-IT')}</span>
                </p>
              </article>

              {/* Role Card */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:p-6">
                <span className="island-kicker mb-2 block">Ruolo Utente</span>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-[var(--sea-ink)] font-semibold capitalize">
                      Membro Club
                    </span>
                  </div>
                  <span className="text-xs text-[var(--sea-ink-soft)] font-medium bg-stone-500/10 px-2 py-0.5 rounded">
                    {user.member_number}
                  </span>
                </div>
                <p className="mt-4 text-xs text-[var(--sea-ink-soft)]">
                  Iscritto il: <span className="font-semibold">{new Date(user.joined_at).toLocaleDateString('it-IT')}</span>
                </p>
              </article>

              {/* Quick action Info Card */}
              <article className="island-shell feature-card rounded-2xl p-4 sm:col-span-2 sm:p-6 lg:col-span-1">
                <span className="island-kicker mb-2 block">Sicurezza & Privacy</span>
                <div className="mt-2 text-sm text-[var(--sea-ink-soft)]">
                  I tuoi dati sono custoditi interamente in locale su questo computer.
                </div>
                <div className="flex items-center gap-1.5 mt-4 text-xs text-emerald-500 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Connessione Locale Sicura
                </div>
              </article>
            </div>
          )}
        </section>
      ) : (
        /* Marketing / Info Grid for Guests */
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Gestione Iscritti Rapida',
              desc: 'Gli amministratori possono aggiungere membri, generare tessere QR e ristamparle quando serve.',
              icon: PlusCircle,
              color: 'text-rose-500',
            },
            {
              title: 'Rilevamento QR ad Alta Velocità',
              desc: 'Pagina scanner integrata per registrare ingressi e salvare presenze persistenti consultabili per giorno.',
              icon: QrCode,
              color: 'text-amber-500',
            },
            {
              title: 'Zero Cloud, Massima Sicurezza',
              desc: 'Tutto funziona in locale. Dati soci e storico presenze restano sul computer del club.',
              icon: Shield,
              color: 'text-emerald-500',
            },
          ].map((item, index) => (
            <article
              key={item.title}
              className="island-shell feature-card rise-in rounded-2xl p-4 sm:p-6"
              style={{ animationDelay: `${index * 80 + 80}ms` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <item.icon className={`w-6 h-6 ${item.color}`} />
                <h3 className="m-0 text-base font-bold text-[var(--sea-ink)]">
                  {item.title}
                </h3>
              </div>
              <p className="m-0 text-sm text-[var(--sea-ink-soft)] leading-relaxed">
                {item.desc}
              </p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
