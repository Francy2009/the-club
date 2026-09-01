import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 non accetta piu' `url` dentro `datasource` nello schema: la URL vive
// qui e serve solo alla CLI (migrate, db push, studio). Il client a runtime non
// la usa affatto, riceve un driver adapter — vedi src/lib/db.ts.
//
// Il default punta allo stesso file di prima (prisma/dev.db), cosi' il
// comportamento di sviluppo non cambia; DATABASE_URL lo sovrascrive.
const defaultDatabaseUrl = `file:${path.join(process.cwd(), 'prisma', 'dev.db')}`

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? defaultDatabaseUrl,
  },
  migrations: {
    seed: 'jiti prisma/seed.ts',
  },
})
