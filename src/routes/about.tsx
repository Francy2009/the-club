import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap py-8 sm:px-4 sm:py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Gestore Pub</p>
        <h1 className="display-title mb-3 text-3xl font-bold leading-tight text-[var(--sea-ink)] sm:text-5xl">
          Gestione locale per soci e presenze.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          L'app mantiene anagrafica, tessere QR, rinnovi e storico ingressi
          sul computer del club, con backup esportabile quando serve.
        </p>
      </section>
    </main>
  )
}
