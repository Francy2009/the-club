import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const PASSWORD_HASH_VERSION = 'pbkdf2_sha512';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

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

async function main() {
  const generatedPassword = !process.env.ADMIN_RESET_PASSWORD;
  const temporaryPassword = process.env.ADMIN_RESET_PASSWORD || generateTemporaryPassword();

  if (!PASSWORD_REGEX.test(temporaryPassword)) {
    throw new Error('ADMIN_RESET_PASSWORD deve avere almeno 8 caratteri, una maiuscola, un numero e un simbolo.');
  }

  const passwordHash = hashPassword(temporaryPassword);

  let admin = await prisma.member.findFirst({
    where: { role: { is: { role: 'admin' } } },
    include: { role: true },
  });

  if (!admin) {
    admin = await prisma.member.findUnique({
      where: { username: 'admin' },
      include: { role: true },
    });
  }

  if (!admin) {
    admin = await prisma.member.create({
      data: {
        first_name: 'Admin',
        last_name: 'Club',
        member_number: null,
        username: 'admin',
        password: passwordHash,
        joined_at: new Date(),
        expiry_date: null,
        password_changed: false,
        must_setup: true,
        role: {
          create: {
            role: 'admin',
          },
        },
      },
      include: { role: true },
    });
  } else {
    admin = await prisma.member.update({
      where: { id: admin.id },
      data: {
        password: passwordHash,
        password_changed: false,
        must_setup: true,
        member_number: null,
        expiry_date: null,
        role: !admin.role
          ? {
              create: {
                role: 'admin',
              },
            }
          : admin.role.role !== 'admin'
            ? {
                update: {
                  role: 'admin',
                },
              }
            : undefined,
      },
      include: { role: true },
    });
  }

  await prisma.session.updateMany({
    where: {
      memberId: admin.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  console.log('Reset admin completato.');
  console.log(`Username: ${admin.username}`);
  if (generatedPassword) {
    console.log('Una password temporanea sicura è stata generata. Salvatela ora; non verrà mostrata di nuovo.');
    console.log(`Password temporanea: ${temporaryPassword}`);
  } else {
    console.log('Password temporanea caricata da ADMIN_RESET_PASSWORD environment variable.');
  }
  console.log('Accedi e imposta subito una nuova password dalla schermata iniziale.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
