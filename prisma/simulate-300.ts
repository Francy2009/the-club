import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const PASSWORD_HASH_VERSION = 'pbkdf2_sha512';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const DEMO_PREFIX = 'SIM';

const firstNames = [
  'Alessandro', 'Giulia', 'Lorenzo', 'Sofia', 'Matteo', 'Aurora', 'Leonardo', 'Ginevra', 'Francesco', 'Beatrice',
  'Tommaso', 'Alice', 'Edoardo', 'Emma', 'Riccardo', 'Marta', 'Davide', 'Chiara', 'Gabriele', 'Elisa',
  'Nicolò', 'Viola', 'Samuele', 'Greta', 'Andrea', 'Noemi', 'Pietro', 'Arianna', 'Filippo', 'Camilla',
  'Youssef', 'Amina', 'Omar', 'Fatima', 'Karim', 'Nadia', 'Luca', 'Sara', 'Marco', 'Irene',
  'Daniel', 'Miriam', 'Alex', 'Rebecca', 'Ivan', 'Olga', 'Milos', 'Anya', 'Kenji', 'Mei',
  'Luis', 'Isabel', 'Carlos', 'Valentina', 'Miguel', 'Lucia', 'Noah', 'Emily', 'Oliver', 'Hannah',
];

const lastNames = [
  'Rossi', 'Bianchi', 'Ferrari', 'Russo', 'Romano', 'Gallo', 'Costa', 'Fontana', 'Conti', 'Esposito',
  'Ricci', 'Bruno', 'Moretti', 'Marino', 'Greco', 'Barbieri', 'Lombardi', 'Giordano', 'Colombo', 'Mancini',
  'Ahmed', 'Hassan', 'Khan', 'Benali', 'El Amrani', 'Nowak', 'Kowalski', 'Petrov', 'Horvat', 'Nakamura',
  'Tanaka', 'Garcia', 'Lopez', 'Martinez', 'Silva', 'Santos', 'Johnson', 'Smith', 'Brown', 'Taylor',
  'De Luca', 'Vitale', 'Serra', 'Rinaldi', 'Longo', 'De Santis', 'Fabbri', 'Monti', 'Pellegrini', 'Testa',
];

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, 'sha512')
    .toString('hex');
  return `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

function generateTemporaryPassword(length = 16): string {
  const requiredChars = ['A', 'a', '1', '!'];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const passwordChars = [...requiredChars];

  while (passwordChars.length < length) {
    passwordChars.push(chars[crypto.randomInt(chars.length)]);
  }

  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24);
}

function makeExpiry(index: number, today: Date) {
  if (index < 75) return addDays(today, -1 - (index % 220)); // scaduti
  if (index < 145) return addDays(today, index % 31); // in scadenza entro 30 giorni
  if (index < 210) return addDays(today, 31 + (index % 60)); // medio termine
  return addDays(today, 100 + (index % 300)); // validi lunghi
}

async function main() {
  console.log('Creo simulazione con 300 soci demo...');

  const demoMembers = await prisma.member.findMany({
    where: {
      member_number: {
        startsWith: `${DEMO_PREFIX}-`,
      },
    },
    select: { id: true },
  });

  if (demoMembers.length > 0) {
    console.log(`Rimuovo ${demoMembers.length} soci demo esistenti...`);
    await prisma.member.deleteMany({
      where: {
        id: { in: demoMembers.map((member) => member.id) },
      },
    });
  }

  const today = new Date();
  const createdMembers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    member_number: string;
  }> = [];

  for (let index = 0; index < 300; index++) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index * 7) % lastNames.length];
    const memberNumber = `${DEMO_PREFIX}-${String(index + 1).padStart(4, '0')}`;
    const expiryDate = makeExpiry(index, today);
    const joinedAt = addDays(expiryDate, -365);
    const username = `${DEMO_PREFIX.toLowerCase()}_${slug(firstName)}_${slug(lastName)}_${String(index + 1).padStart(4, '0')}`;

    const member = await prisma.member.create({
      data: {
        first_name: firstName,
        last_name: lastName,
        member_number: memberNumber,
        qr_token: crypto.randomBytes(32).toString('base64url'),
        username,
        password: hashPassword(generateTemporaryPassword()),
        joined_at: joinedAt,
        expiry_date: expiryDate,
        password_changed: false,
        must_setup: true,
        role: {
          create: { role: 'user' },
        },
      },
    });

    createdMembers.push({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      member_number: member.member_number ?? memberNumber,
    });
  }

  const activeMembers = createdMembers.slice(75);
  const attendanceRows = [];

  for (let dayOffset = 0; dayOffset < 45; dayOffset++) {
    const attendanceDate = addDays(today, -dayOffset);
    const checkInDay = getLocalDateKey(attendanceDate);
    const dailyCount = 18 + (dayOffset % 17);

    for (let slot = 0; slot < dailyCount; slot++) {
      const member = activeMembers[(dayOffset * 13 + slot * 7) % activeMembers.length];
      const checkInTime = new Date(attendanceDate);
      checkInTime.setHours(18 + (slot % 5), (slot * 7) % 60, (slot * 11) % 60, 0);

      attendanceRows.push({
        member_id: member.id,
        check_in_time: checkInTime,
        check_in_day: checkInDay,
        member_first_name: member.first_name,
        member_last_name: member.last_name,
        member_number: member.member_number,
      });
    }
  }

  let createdAttendances = 0;
  for (const row of attendanceRows) {
    try {
      await prisma.attendance.create({
        data: row,
      });
      createdAttendances++;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  console.log('Simulazione completata.');
  console.log(`Soci demo creati: ${createdMembers.length}`);
  console.log('Distribuzione tessere: 75 scadute, 70 in scadenza entro 30 giorni, 155 valide.');
  console.log(`Presenze demo create: ${createdAttendances}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
