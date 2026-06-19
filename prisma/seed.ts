import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const PASSWORD_HASH_VERSION = 'pbkdf2_sha512';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_KEY_LENGTH = 64;

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
  // Clean existing admins just in case
  const existingAdmin = await prisma.member.findUnique({
    where: { username: 'admin' },
  });

  if (existingAdmin) {
    await prisma.member.update({
      where: { id: existingAdmin.id },
      data: {
        member_number: null,
        expiry_date: null,
      },
    });
    console.log('Admin already exists, normalized as system account.');
    return;
  }

  // Create initial admin
  const generatedInitialPassword = !process.env.ADMIN_INITIAL_PASSWORD;
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || generateTemporaryPassword();
  const adminPasswordHash = hashPassword(initialPassword);
  
  const admin = await prisma.member.create({
    data: {
      first_name: 'Admin',
      last_name: 'Club',
      member_number: null,
      username: 'admin',
      password: adminPasswordHash,
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
  });

  console.log('Seed completed successfully.');
  console.log('Created Admin:', admin.username);
  if (generatedInitialPassword) {
    console.log('A secure initial admin password was generated. Save it now; it will not be shown again.');
    console.log(`Initial admin password: ${initialPassword}`);
  } else {
    console.log('Initial admin password loaded from ADMIN_INITIAL_PASSWORD environment variable.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
