import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server';
import { prisma } from './db';
import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'club_member_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_TOKEN_BYTES = 32;
const PASSWORD_HASH_VERSION = 'pbkdf2_sha512';
const PASSWORD_HASH_ITERATIONS = 310000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const LEGACY_PASSWORD_HASH_ITERATIONS = 1000;
// Recovery question uses same hashing as password but with different version prefix
const RECOVERY_QUESTION_HASH_VERSION = 'recovery_q_sha512';
const RECOVERY_QUESTION_HASH_ITERATIONS = 100000;

function timingSafeEqualHex(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');

  if (aBuffer.length !== bBuffer.length) return false;

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, 'sha512')
    .toString('hex');
  return `${PASSWORD_HASH_VERSION}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const modernParts = storedHash.split('$');
  if (modernParts.length === 4 && modernParts[0] === PASSWORD_HASH_VERSION) {
    const [, iterationsValue, salt, hash] = modernParts;
    const iterations = Number(iterationsValue);
    if (!Number.isInteger(iterations) || iterations <= 0 || iterations > 1000000 || !salt || !hash) return false;

    const verifyHash = crypto
      .pbkdf2Sync(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, 'sha512')
      .toString('hex');
    return timingSafeEqualHex(verifyHash, hash);
  }

  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const verifyHash = crypto
    .pbkdf2Sync(password, salt, LEGACY_PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, 'sha512')
    .toString('hex');
  return timingSafeEqualHex(verifyHash, hash);
}

/**
 * Hash a recovery question for storage (not the answer, the question itself).
 * This prevents the recovery question from being stored in clear text.
 */
export function hashRecoveryQuestion(question: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(question, salt, RECOVERY_QUESTION_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, 'sha512')
    .toString('hex');
  return `${RECOVERY_QUESTION_HASH_VERSION}$${RECOVERY_QUESTION_HASH_ITERATIONS}$${salt}$${hash}`;
}

/**
 * Verify a recovery question against its stored hash.
 */
export function verifyRecoveryQuestion(question: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length === 4 && parts[0] === RECOVERY_QUESTION_HASH_VERSION) {
    const [, iterationsValue, salt, hash] = parts;
    const iterations = Number(iterationsValue);
    if (!Number.isInteger(iterations) || iterations <= 0 || iterations > 1000000 || !salt || !hash) return false;

    const verifyHash = crypto
      .pbkdf2Sync(question, salt, iterations, PASSWORD_HASH_KEY_LENGTH, 'sha512')
      .toString('hex');
    return timingSafeEqualHex(verifyHash, hash);
  }
  return false;
}
export async function setSession(memberId: string) {
  const token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  const expiresAt = getSessionExpiry();

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      memberId,
      expiresAt,
    },
  });

  setCookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = getCookie(SESSION_COOKIE_NAME);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      memberId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    deleteCookie(SESSION_COOKIE_NAME, {
      path: '/',
    });
    return null;
  }

  return session.memberId;
}

export async function destroySession() {
  const token = getCookie(SESSION_COOKIE_NAME);

  if (token) {
    await prisma.session.updateMany({
      where: {
        tokenHash: hashSessionToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  deleteCookie(SESSION_COOKIE_NAME, {
    path: '/',
  });
}

export async function getAuthenticatedUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const fullMember = await prisma.member.findUnique({
    where: { id: userId },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      username: true,
      joined_at: true,
      password_changed: true,
      must_setup: true,
      role: { select: { role: true } },
      member_number: true,
      qr_token: true,
      expiry_date: true,
    },
  });

  if (!fullMember) return null;

  const role = fullMember.role?.role || 'user';

  if (role === 'admin') {
    return {
      id: fullMember.id,
      first_name: fullMember.first_name,
      last_name: fullMember.last_name,
      member_number: null,
      qr_token: null,
      username: fullMember.username,
      joined_at: fullMember.joined_at.toISOString(),
      expiry_date: null,
      password_changed: fullMember.password_changed,
      must_setup: fullMember.must_setup,
      role,
    };
  }

  return {
    id: fullMember.id,
    first_name: fullMember.first_name,
    last_name: fullMember.last_name,
    member_number: fullMember.member_number ?? null,
    qr_token: fullMember.qr_token ?? null,
    username: fullMember.username,
    joined_at: fullMember.joined_at.toISOString(),
    expiry_date: fullMember.expiry_date?.toISOString() ?? null,
    password_changed: fullMember.password_changed,
    must_setup: fullMember.must_setup,
    role,
  };
}
