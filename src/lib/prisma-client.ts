import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'node:path';

// Percorso assoluto di dev.db nella cartella prisma/ della root del progetto.
// Era la stessa risoluzione che faceva src/lib/db.ts prima di Prisma 7.
const databaseUrl = `file:${path.resolve(process.cwd(), 'prisma/dev.db')}`;

type PrismaClientOptions = NonNullable<ConstructorParameters<typeof PrismaClient>[0]>;

/**
 * Da Prisma 7 il client non apre più il database da sé: vuole un driver
 * adapter esplicito. Questa è l'unica funzione che lo costruisce, così il
 * percorso del database e le opzioni dell'adapter stanno scritti in un posto
 * solo (client dell'app e script in prisma/ passano tutti di qui).
 *
 * `timestampFormat: 'unixepoch-ms'` non è un dettaglio: Prisma 6 salvava le
 * DateTime come INTEGER (millisecondi epoch), mentre il default dell'adapter è
 * 'iso8601', cioè TEXT. Su un database già esistente le righe nuove finirebbero
 * in un formato diverso dalle vecchie e, dato che SQLite confronta prima per
 * classe di storage, ogni filtro per data smetterebbe di vedere le righe
 * scritte da Prisma 6: soci con la loro scadenza, presenze, riepiloghi.
 * Il database resterebbe integro ma l'app ne mostrerebbe solo una parte.
 */
export function createPrismaClient(options?: Omit<PrismaClientOptions, 'adapter'>) {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: databaseUrl }, { timestampFormat: 'unixepoch-ms' }),
    ...options,
  });
}
