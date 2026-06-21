import { createServerFn } from '@tanstack/react-start';
import { prisma } from './db';
import { getAuthenticatedUser, verifyPassword, hashPassword, setSession, destroySession, hashRecoveryQuestion } from './auth.server';
import crypto from 'node:crypto';

type AuthenticatedUser = {
  id: string;
  role: string;
  password_changed: boolean;
  must_setup: boolean;
};

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
const RECOVERY_LOCK_MS = 30 * 60 * 1000;
const RECOVERY_MAX_FAILURES = 5;
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const MAX_BACKUP_MEMBERS = 10000;
const MAX_BACKUP_ATTENDANCES = 250000;
const BACKUP_APPLICATION = 'the-club';
const LEGACY_BACKUP_APPLICATION = 'gestore-pub';

// Admin rate limiting constants
const ADMIN_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ADMIN_MAX_REQUESTS = 100; // 100 requests per hour per admin
const ADMIN_SENSITIVE_MAX_REQUESTS = 10; // 10 sensitive ops per hour (export, restore, delete)

/**
 * Rate limiting for admin actions - tracks by admin user ID
 * Uses atomic database operations to prevent race conditions
 */
async function assertAdminAllowed(adminId: string, type: 'general' | 'sensitive' = 'general') {
  const configKey = type === 'sensitive' ? 'admin_sensitive' : 'admin_general';
  const result = await checkAndRecordRateLimit(`admin:${adminId}:${type}`, configKey);
  if (!result.allowed) {
    throw new Error(`Troppi richieste admin. Riprova tra ${result.retryAfterMinutes} min.`);
  }
}

/**
 * Generates a unique dummy password hash per request for timing-safe comparison
 * with non-existent users. This prevents username enumeration attacks.
 */
function generateDummyPasswordHash(): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(crypto.randomBytes(32).toString('base64url'), salt, 310000, 64, 'sha512')
    .toString('hex');
  return `pbkdf2_sha512$310000$${salt}$${hash}`;
}

// SQLite-based rate limiting functions (persistent across restarts)
// Uses atomic database operations to prevent race conditions

interface RateLimitConfig {
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  type: 'login' | 'recovery' | 'admin';
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { windowMs: LOGIN_WINDOW_MS, maxFailures: LOGIN_MAX_FAILURES, lockMs: LOGIN_LOCK_MS, type: 'login' },
  recovery: { windowMs: RECOVERY_WINDOW_MS, maxFailures: RECOVERY_MAX_FAILURES, lockMs: RECOVERY_LOCK_MS, type: 'recovery' },
  admin_general: { windowMs: ADMIN_WINDOW_MS, maxFailures: ADMIN_MAX_REQUESTS, lockMs: ADMIN_WINDOW_MS, type: 'admin' },
  admin_sensitive: { windowMs: ADMIN_WINDOW_MS, maxFailures: ADMIN_SENSITIVE_MAX_REQUESTS, lockMs: ADMIN_WINDOW_MS, type: 'admin' },
};

/**
 * Atomically check and record a rate limit attempt.
 * Returns { allowed: boolean, lockedUntil?: Date, retryAfterMinutes?: number }
 */
async function checkAndRecordRateLimit(
  identifier: string,
  configKey: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{ allowed: boolean; lockedUntil?: Date; retryAfterMinutes?: number }> {
  const config = RATE_LIMIT_CONFIGS[configKey];
  const now = new Date();
  const windowStartMs = now.getTime() - config.windowMs;

  // Use a transaction to atomically check and update
  return await prisma.$transaction(async (tx) => {
    // Find existing attempt
    const attempt = await tx.rateLimitAttempt.findUnique({
      where: { identifier_type: { identifier, type: config.type } },
    });

    // No previous attempt - create new record with count 1
    if (!attempt) {
      await tx.rateLimitAttempt.create({
        data: {
          identifier,
          type: config.type,
          failedCount: 1,
          windowStart: now,
          lockedUntil: null,
        },
      });
      return { allowed: true };
    }

    // Check if currently locked
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      const minutes = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 60000);
      return { allowed: false, lockedUntil: attempt.lockedUntil, retryAfterMinutes: minutes };
    }

    // Check if window has expired - if so, reset counter
    if (attempt.windowStart.getTime() < windowStartMs) {
      await tx.rateLimitAttempt.update({
        where: { identifier_type: { identifier, type: config.type } },
        data: {
          failedCount: 1,
          windowStart: now,
          lockedUntil: null,
          updatedAt: now,
        },
      });
      return { allowed: true };
    }

    // Window still active - increment counter
    const nextCount = attempt.failedCount + 1;
    let nextLockedUntil: Date | null = null;

    if (nextCount >= config.maxFailures) {
      nextLockedUntil = new Date(now.getTime() + config.lockMs);
    }

    await tx.rateLimitAttempt.update({
      where: { identifier_type: { identifier, type: config.type } },
      data: {
        failedCount: nextCount,
        lockedUntil: nextLockedUntil,
        updatedAt: now,
      },
    });

    if (nextLockedUntil) {
      const minutes = Math.ceil(config.lockMs / 60000);
      return { allowed: false, lockedUntil: nextLockedUntil, retryAfterMinutes: minutes };
    }

    return { allowed: true };
  });
}

async function checkRateLimitAllowed(
  identifier: string,
  configKey: keyof typeof RATE_LIMIT_CONFIGS
): Promise<{ allowed: boolean; lockedUntil?: Date; retryAfterMinutes?: number }> {
  const config = RATE_LIMIT_CONFIGS[configKey];
  const now = new Date();
  const attempt = await prisma.rateLimitAttempt.findUnique({
    where: { identifier_type: { identifier, type: config.type } },
  });

  if (!attempt) return { allowed: true };

  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    const minutes = Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 60000);
    return { allowed: false, lockedUntil: attempt.lockedUntil, retryAfterMinutes: minutes };
  }

  return { allowed: true };
}

/**
 * Clear rate limit failures for an identifier (on successful login/recovery)
 */
async function clearRateLimitFailures(identifier: string, type: 'login' | 'recovery') {
  const key = identifier.toLowerCase();
  await prisma.rateLimitAttempt.deleteMany({
    where: { identifier: key, type },
  });
}

// Backward-compatible wrapper functions
async function assertLoginAllowed(username: string) {
  const result = await checkRateLimitAllowed(username.toLowerCase(), 'login');
  if (!result.allowed) {
    throw new Error(`Troppi tentativi non riusciti. Riprova tra ${result.retryAfterMinutes} min.`);
  }
}

async function recordLoginFailure(username: string) {
  await checkAndRecordRateLimit(username.toLowerCase(), 'login');
}

async function clearLoginFailures(username: string) {
  await clearRateLimitFailures(username, 'login');
}

async function assertRecoveryAllowed(username: string) {
  const result = await checkRateLimitAllowed(username.toLowerCase(), 'recovery');
  if (!result.allowed) {
    throw new Error(`Troppi tentativi di recupero. Riprova tra ${result.retryAfterMinutes} min.`);
  }
}

async function recordRecoveryFailure(username: string) {
  await checkAndRecordRateLimit(username.toLowerCase(), 'recovery');
}

async function clearRecoveryFailures(username: string) {
  await clearRateLimitFailures(username, 'recovery');
}

function assertRecord(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    throw new Error('Input non valido');
  }
}

function requiredString(data: Record<string, unknown>, key: string, maxLength = 255): string {
  const value = data[key];
  if (typeof value !== 'string') {
    throw new Error('Input non valido');
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error('Input non valido');
  }

  return trimmed;
}

function optionalDateString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('Data non valida');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data non valida');
  }

  return value;
}

function requiredDateString(data: Record<string, unknown>, key: string): string {
  const value = optionalDateString(data, key);
  if (!value) {
    throw new Error('Data non valida');
  }

  return value;
}

function nullableString(data: Record<string, unknown>, key: string, maxLength = 255): string | null {
  const value = data[key];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') {
    throw new Error('Input non valido');
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error('Input non valido');
  }

  return trimmed;
}

function assertStrongPassword(password: string, message: string) {
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(message);
  }
}

function normalizeRecoveryQuestion(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeRecoveryAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeLegacyRecoveryPhrase(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function assertRecoveryQuestion(question: string) {
  const normalized = normalizeRecoveryQuestion(question);
  if (normalized.length < 6 || normalized.length > 120) {
    throw new Error('La domanda di recupero deve contenere tra 6 e 120 caratteri.');
  }
}

function assertRecoveryAnswer(answer: string) {
  const normalized = normalizeRecoveryAnswer(answer);
  const wordCount = normalized.split(' ').filter(Boolean).length;

  if (normalized.length < 2 || normalized.length > 80 || wordCount > 4) {
    throw new Error('La risposta di recupero deve contenere da 1 a 4 parole.');
  }
}

function assertAllowedRole(role: string): asserts role is 'admin' | 'user' {
  if (role !== 'admin' && role !== 'user') {
    throw new Error('Backup non valido: ruolo non riconosciuto');
  }
}

function assertUniqueValues(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Backup non valido: valore duplicato in ${label}`);
    }
    seen.add(value);
  }
}

function assertPasswordHash(value: string) {
  const modern = value.match(/^pbkdf2_sha512\$(\d+)\$([a-f0-9]{32,128})\$([a-f0-9]{128})$/i);
  if (modern) {
    const iterations = Number(modern[1]);
    if (Number.isInteger(iterations) && iterations >= 100000 && iterations <= 1000000) {
      return;
    }
  }

  const legacy = value.match(/^[a-f0-9]{16,128}:[a-f0-9]{128}$/i);
  if (legacy) return;

  throw new Error('Backup non valido: hash password non riconosciuto');
}

function generateTemporaryPassword(length = 12): string {
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

function generateQrToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Data non valida');
  }
  return getLocalDateKey(date);
}

function getMemberSnapshot(attendance: {
  member_id: string | null;
  member_first_name: string;
  member_last_name: string;
  member_number: string;
  member_was_deleted: boolean;
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    member_number: string | null;
  } | null;
}) {
  return {
    id: attendance.member?.id ?? attendance.member_id ?? '',
    first_name: attendance.member?.first_name ?? attendance.member_first_name,
    last_name: attendance.member?.last_name ?? attendance.member_last_name,
    member_number: attendance.member?.member_number ?? attendance.member_number,
    deleted: attendance.member_was_deleted || !attendance.member,
  };
}

function isUniqueConstraintError(error: unknown): error is { code: 'P2002'; meta?: { target?: unknown } } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function uniqueTargetIncludes(error: { meta?: { target?: unknown } }, field: string): boolean {
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? '').includes(field);
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n');
}

function assertReadyAdmin(user: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  if (!user || user.role !== 'admin') {
    throw new Error('Accesso non autorizzato');
  }

  if (user.must_setup || !user.password_changed) {
    throw new Error("Completa prima la configurazione dell'account amministratore");
  }
}

async function getBootstrapAdmin() {
  const memberCount = await prisma.member.count();

  if (memberCount === 0) {
    return await prisma.member.create({
      data: {
        first_name: 'Admin',
        last_name: 'Club',
        member_number: null,
        qr_token: null,
        username: 'admin',
        password: hashPassword(crypto.randomBytes(32).toString('base64url')),
        recovery_question: null,
        recovery_phrase_hash: null,
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
  }

  if (memberCount !== 1) return null;

  const admin = await prisma.member.findFirst({
    include: { role: true },
  });

  if (!admin || admin.role?.role !== 'admin') return null;
  if (!admin.must_setup && admin.password_changed && admin.recovery_question && admin.recovery_phrase_hash) return null;

  return admin;
}

function serializeAuthenticatedMember(member: Awaited<ReturnType<typeof getBootstrapAdmin>>) {
  if (!member) return null;

  const role = member.role?.role || 'user';

  return {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: role === 'admin' ? null : member.member_number,
    qr_token: role === 'admin' ? null : member.qr_token,
    username: member.username,
    joined_at: member.joined_at.toISOString(),
    expiry_date: role === 'admin' ? null : member.expiry_date?.toISOString() ?? null,
    password_changed: member.password_changed,
    must_setup: member.must_setup,
    role,
  };
}

// Password complexity Zod schema (min 8 chars, 1 uppercase, 1 number, 1 symbol)
export const setupValidator = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      username: requiredString(data, 'username', 80),
      password: requiredString(data, 'password', 256),
      recovery_question: requiredString(data, 'recovery_question', 120),
      recovery_answer: requiredString(data, 'recovery_answer', 80),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    if (!user) {
      throw new Error('Non sei autenticato');
    }

    assertStrongPassword(data.password, 'La password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.');
    assertRecoveryQuestion(data.recovery_question);
    assertRecoveryAnswer(data.recovery_answer);

    const trimmedUsername = data.username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      throw new Error('Lo username deve contenere almeno 3 caratteri.');
    }

    // Check if username is already taken by someone else
    const usernameExists = await prisma.member.findFirst({
      where: {
        username: trimmedUsername,
        id: { not: user.id },
      },
    });

    if (usernameExists) {
      throw new Error('Questo username è già in uso.');
    }

    const hashed = hashPassword(data.password);
    const recoveryQuestion = normalizeRecoveryQuestion(data.recovery_question);
    const recoveryQuestionHash = hashRecoveryQuestion(recoveryQuestion);
    const recoveryAnswerHash = hashPassword(normalizeRecoveryAnswer(data.recovery_answer));

    try {
      await prisma.member.update({
        where: { id: user.id },
        data: {
          username: trimmedUsername,
          password: hashed,
          recovery_question: recoveryQuestionHash,
          recovery_phrase_hash: recoveryAnswerHash,
          password_changed: true,
          must_setup: false,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) && uniqueTargetIncludes(error, 'username')) {
        throw new Error('Questo username è già in uso.');
      }
      throw error;
    }

    await prisma.session.updateMany({
      where: {
        memberId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await setSession(user.id);

    return { success: true, role: user.role };
  });

// Admin-only: change the current administrator password after verifying the old one
export const changeAdminPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      current_password: requiredString(data, 'current_password', 256),
      new_password: requiredString(data, 'new_password', 256),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    const admin = await prisma.member.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
        role: true,
      },
    });

    if (!admin || admin.role?.role !== 'admin') {
      throw new Error('Accesso non autorizzato');
    }

    if (!verifyPassword(data.current_password, admin.password)) {
      throw new Error('La password attuale non è corretta');
    }

    assertStrongPassword(data.new_password, 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.');

    if (verifyPassword(data.new_password, admin.password)) {
      throw new Error('La nuova password deve essere diversa da quella attuale');
    }

    await prisma.member.update({
      where: { id: admin.id },
      data: {
        password: hashPassword(data.new_password),
        password_changed: true,
        must_setup: false,
      },
    });

    // Revoke all existing sessions (security: rotate session on password change)
    await prisma.session.updateMany({
      where: {
        memberId: admin.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Create new session with fresh token
    await setSession(admin.id);

    return { success: true };
  });

export const changeAdminRecoveryPhraseFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      current_password: requiredString(data, 'current_password', 256),
      recovery_question: requiredString(data, 'recovery_question', 120),
      recovery_answer: requiredString(data, 'recovery_answer', 80),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    const admin = await prisma.member.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        password: true,
        role: true,
      },
    });

    if (!admin || admin.role?.role !== 'admin') {
      throw new Error('Accesso non autorizzato');
    }

    if (!verifyPassword(data.current_password, admin.password)) {
      throw new Error('La password attuale non è corretta');
    }

    assertRecoveryQuestion(data.recovery_question);
    assertRecoveryAnswer(data.recovery_answer);

    const recoveryQuestion = normalizeRecoveryQuestion(data.recovery_question);
    const recoveryQuestionHash = hashRecoveryQuestion(recoveryQuestion);
    const recoveryAnswerHash = hashPassword(normalizeRecoveryAnswer(data.recovery_answer));

    await prisma.member.update({
      where: { id: admin.id },
      data: {
        recovery_question: recoveryQuestionHash,
        recovery_phrase_hash: recoveryAnswerHash,
      },
    });

    // Revoke all existing sessions (security: rotate session on recovery answer change)
    await prisma.session.updateMany({
      where: {
        memberId: admin.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    // Create new session with fresh token
    await setSession(admin.id);

    return { success: true };
  });

export const getRecoveryQuestionFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      username: requiredString(data, 'username', 80),
    };
  })
  .handler(async ({ data }) => {
    const username = data.username.trim().toLowerCase();
    await checkRateLimitAllowed(username, 'recovery');
    // Generic response: recoverPasswordFn performs the real validation without
    // revealing whether the username exists or recovery is configured.
    return { hasRecovery: true };
  });

export const recoverPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      username: requiredString(data, 'username', 80),
      recovery_answer: requiredString(data, 'recovery_answer', 500),
      new_password: requiredString(data, 'new_password', 256),
    };
  })
  .handler(async ({ data }) => {
    const username = data.username.trim().toLowerCase();
    // Always check rate limit first (constant-time for non-existent users)
    await assertRecoveryAllowed(username);
    assertStrongPassword(data.new_password, 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.');

    const member = await prisma.member.findUnique({
      where: { username },
      select: {
        id: true,
        password: true,
        recovery_question: true,
        recovery_phrase_hash: true,
        role: {
          select: {
            role: true,
          },
        },
      },
    });

    // Check if member has recovery configured (recovery_question hash exists)
    const hasRecoveryConfigured = !!member?.recovery_question;

    if (hasRecoveryConfigured) {
      assertRecoveryAnswer(data.recovery_answer);
    }

    // Always verify recovery answer (constant-time using dummy hash for non-existent users)
    const dummyRecoveryHash = generateDummyPasswordHash();
    const storedRecoveryHash = member?.recovery_phrase_hash ?? dummyRecoveryHash;
    const isValidRecovery =
      verifyPassword(normalizeRecoveryAnswer(data.recovery_answer), storedRecoveryHash) ||
      verifyPassword(normalizeLegacyRecoveryPhrase(data.recovery_answer), storedRecoveryHash);

    // Check if member exists AND has recovery answer set AND answer is valid
    const memberExistsAndValid = member && member.recovery_phrase_hash && isValidRecovery;

    if (!memberExistsAndValid) {
      // Always record failure (even for non-existent users) to prevent enumeration
      await recordRecoveryFailure(username);
      throw new Error('Username o risposta di recupero non validi.');
    }

    if (verifyPassword(data.new_password, member.password)) {
      throw new Error('La nuova password deve essere diversa da quella attuale');
    }

    await clearRecoveryFailures(username);
    await clearLoginFailures(username);

    await prisma.member.update({
      where: { id: member.id },
      data: {
        password: hashPassword(data.new_password),
        password_changed: true,
        must_setup: false,
      },
    });

    await prisma.session.updateMany({
      where: {
        memberId: member.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await setSession(member.id);

    return { success: true, role: member.role?.role ?? 'user' };
  });

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      username: requiredString(data, 'username', 80),
      password: requiredString(data, 'password', 256),
    };
  })
  .handler(async ({ data }) => {
    const searchUsername = data.username.trim().toLowerCase();
    // Always check rate limit first (constant-time for non-existent users)
    await assertLoginAllowed(searchUsername);

    const member = await prisma.member.findUnique({
      where: { username: searchUsername },
      select: {
        id: true,
        password: true,
        password_changed: true,
        must_setup: true,
        role: {
          select: {
            role: true,
          },
        },
      },
    });

    // Always verify password (constant-time using dummy hash for non-existent users)
    const dummyPasswordHash = generateDummyPasswordHash();
    const passwordHash = member?.password ?? dummyPasswordHash;
    const isValid = verifyPassword(data.password, passwordHash);

    if (!member || !isValid) {
      // Always record failure (even for non-existent users) to prevent enumeration
      await recordLoginFailure(searchUsername);
      throw new Error('Credenziali non valide');
    }

    await clearLoginFailures(searchUsername);

    await destroySession();
    await setSession(member.id);

    return {
      success: true,
      mustSetup: member.must_setup || !member.password_changed,
      role: member.role?.role ?? 'user',
    };
  });

export const logoutFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    await destroySession();
    return { success: true };
  });

export const resetLocalDatabaseFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    if (!import.meta.env.DEV || process.env.THE_CLUB_ENABLE_DEV_RESET !== 'true') {
      throw new Error('Reset database non abilitato.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany();
      await tx.rateLimitAttempt.deleteMany();
      await tx.attendance.deleteMany();
      await tx.userRole.deleteMany();
      await tx.member.deleteMany();
    });
    await destroySession();

    return { success: true };
  });

export const getCurrentUserFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await getAuthenticatedUser();
    if (user) return user;

    const bootstrapAdmin = await getBootstrapAdmin();
    if (!bootstrapAdmin) return null;

    await setSession(bootstrapAdmin.id);
    return serializeAuthenticatedMember(bootstrapAdmin);
  });

// Admin-guarded: Get all members
export const getAllMembersFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const members = await prisma.member.findMany({
      where: { role: { is: { role: 'user' } } },
      include: { role: true },
      orderBy: { last_name: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name,
      member_number: m.member_number ?? '',
      qr_token: m.qr_token ?? '',
      username: m.username,
      joined_at: m.joined_at.toISOString(),
      expiry_date: m.expiry_date?.toISOString() ?? '',
      password_changed: m.password_changed,
      must_setup: m.must_setup,
      role: m.role?.role || 'user',
    }));
  });

// Admin-guarded: lightweight member list for fast attendance registration
export const getCheckInMembersFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const members = await prisma.member.findMany({
      where: { role: { is: { role: 'user' } } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        member_number: true,
        expiry_date: true,
      },
      orderBy: [
        { last_name: 'asc' },
        { first_name: 'asc' },
      ],
    });

    return members.map((member) => ({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      member_number: member.member_number ?? '',
      expiry_date: member.expiry_date?.toISOString() ?? '',
    }));
  });

// Admin-guarded: Create user
export const createMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      first_name: requiredString(data, 'first_name', 80),
      last_name: requiredString(data, 'last_name', 80),
      member_number: requiredString(data, 'member_number', 80),
      start_date: optionalDateString(data, 'start_date'),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests (sensitive operation)
    await assertAdminAllowed(user.id, 'sensitive');

    // Normalize input
    const firstName = data.first_name.trim();
    const lastName = data.last_name.trim();
    const memberNumber = data.member_number.trim().toUpperCase();

    if (!firstName || !lastName || !memberNumber) {
      throw new Error('Tutti i campi sono obbligatori');
    }

    // Validate member_number format (alphanumeric, hyphens, underscores only)
    if (!/^[A-Z0-9_-]+$/i.test(memberNumber)) {
      throw new Error('Il numero tessera può contenere solo lettere, numeri, trattini e underscore');
    }

    // Auto-generate username: nome_cognome
    const baseUsername = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    let finalUsername = baseUsername;
    let counter = 1;

    // Check uniqueness of username
    while (true) {
      const existing = await prisma.member.findUnique({
        where: { username: finalUsername },
      });
      if (!existing) break;
      finalUsername = `${baseUsername}${counter}`;
      counter++;
    }

    const securePassword = generateTemporaryPassword();

    const joinedAt = data.start_date ? new Date(data.start_date) : new Date();
    const expiryDate = new Date(joinedAt.getTime() + 365 * 24 * 60 * 60 * 1000); // +365 days

    // Use transaction to atomically check uniqueness and create member
    const newMember = await prisma.$transaction(async (tx) => {
      // Check uniqueness of member number within transaction
      const numberExists = await tx.member.findUnique({
        where: { member_number: memberNumber },
      });
      if (numberExists) {
        throw new Error('Questo numero tessera è già in uso');
      }

      // Double-check username uniqueness within transaction
      const usernameExists = await tx.member.findUnique({
        where: { username: finalUsername },
      });
      if (usernameExists) {
        throw new Error('Username già in uso, riprova la registrazione.');
      }

      return await tx.member.create({
        data: {
          first_name: firstName,
          last_name: lastName,
          member_number: memberNumber,
          qr_token: generateQrToken(),
          username: finalUsername,
          password: hashPassword(securePassword),
          joined_at: joinedAt,
          expiry_date: expiryDate,
          password_changed: false,
          must_setup: true,
          role: {
            create: {
              role: 'user',
            },
          },
        },
      });
    });

    return {
      success: true,
      id: newMember.id,
      username: newMember.username,
      password: securePassword,
      first_name: newMember.first_name,
      last_name: newMember.last_name,
      member_number: newMember.member_number,
      qr_token: newMember.qr_token,
      joined_at: newMember.joined_at.toISOString(),
      expiry_date: newMember.expiry_date?.toISOString() ?? '',
    };
  });

// Admin-guarded: Renew membership (with optional custom start date)
export const renewMembershipFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      member_id: requiredString(data, 'member_id', 120),
      start_date: optionalDateString(data, 'start_date'),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const member = await prisma.member.findUnique({
      where: { id: data.member_id },
      include: { role: true },
    });

    if (!member) {
      throw new Error('Membro non trovato');
    }

    if (member.role?.role === 'admin') {
      throw new Error("L'account amministratore non ha un abbonamento da rinnovare");
    }

    const startDate = data.start_date ? new Date(data.start_date) : new Date();
    const newExpiry = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    await prisma.member.update({
      where: { id: data.member_id },
      data: {
        joined_at: startDate,
        expiry_date: newExpiry,
      },
    });

    return { success: true };
  });

// Admin-guarded: Delete member
export const deleteMemberFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      member_id: requiredString(data, 'member_id', 120),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests (sensitive operation)
    await assertAdminAllowed(user.id, 'sensitive');

    if (user.id === data.member_id) {
      throw new Error('Non puoi eliminare il tuo stesso account amministratore');
    }

    await prisma.$transaction([
      prisma.attendance.updateMany({
        where: { member_id: data.member_id },
        data: { member_was_deleted: true },
      }),
      prisma.member.delete({
        where: { id: data.member_id },
      }),
    ]);

    return { success: true };
  });

// Admin-guarded: Register QR scan / Attendance check-in
export const registerAttendanceFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    const identifier = requiredString(data, 'identifier', 120);
    return { identifier };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    // Determine if input is a UUID (member_id) or base64url (qr_token)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.identifier);

    let member;
    if (isUuid) {
      member = await prisma.member.findUnique({
        where: { id: data.identifier },
        include: { role: true },
      });
    } else {
      // Validate qr_token format (base64url, 43 chars for 32 bytes)
      if (!/^[A-Za-z0-9_-]{43}$/.test(data.identifier)) {
        throw new Error('Formato identificatore non valido');
      }
      member = await prisma.member.findUnique({
        where: { qr_token: data.identifier },
        include: { role: true },
      });
    }

    if (!member) {
      throw new Error('Membro non registrato o codice QR non valido');
    }

    if (member.role?.role === 'admin') {
      throw new Error("L'account amministratore non usa tessere o check-in");
    }

    if (!member.member_number || !member.expiry_date) {
      throw new Error('Tessera membro incompleta: numero tessera o scadenza mancanti');
    }

    // Check if membership is active
    const today = new Date();
    if (member.expiry_date < today) {
      return {
        success: false,
        expired: true,
        alreadyCheckedIn: false,
        member: {
          id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          member_number: member.member_number ?? '',
        },
      };
    }

    // Prevent duplicate attendance for today - use transaction with unique constraint
    const checkInDay = getLocalDateKey(today);

    // Use transaction to atomically check and create attendance
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing attendance within transaction
      const existing = await tx.attendance.findUnique({
        where: {
          member_id_check_in_day: {
            member_id: member.id,
            check_in_day: checkInDay,
          },
        },
      });

      if (existing) {
        return {
          success: true,
          alreadyCheckedIn: true,
          member: {
            id: member.id,
            first_name: member.first_name,
            last_name: member.last_name,
            member_number: member.member_number ?? '',
          },
        };
      }

      // Create attendance record
      await tx.attendance.create({
        data: {
          member_id: member.id,
          check_in_time: today,
          check_in_day: checkInDay,
          member_first_name: member.first_name,
          member_last_name: member.last_name,
          member_number: member.member_number ?? '',
          member_was_deleted: false,
        },
      });

      return {
        success: true,
        alreadyCheckedIn: false,
        member: {
          id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          member_number: member.member_number ?? '',
        },
      };
    });

    return result;
  });

// Admin-guarded: Get today's attendance logs
export const getTodayAttendanceFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const todayKey = getLocalDateKey();

    const attendances = await prisma.attendance.findMany({
      where: {
        check_in_day: todayKey,
      },
      include: {
        member: true,
      },
      orderBy: {
        check_in_time: 'desc',
      },
    });

    return attendances.map((a) => ({
      id: a.id,
      check_in_time: a.check_in_time.toISOString(),
      member: getMemberSnapshot(a),
    }));
  });

// Admin-guarded: Search persisted attendance logs by date range and member text
export const getAttendanceLogsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      date: optionalDateString(data, 'date'),
      date_from: optionalDateString(data, 'date_from'),
      date_to: optionalDateString(data, 'date_to'),
      search: typeof data.search === 'string' ? data.search.trim().slice(0, 120) : '',
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const today = new Date();
    const selectedDateKey = data.date ? parseDateKey(data.date) : undefined;
    const fromKey = selectedDateKey ?? (data.date_from ? parseDateKey(data.date_from) : getLocalDateKey(today));
    const toKey = selectedDateKey ?? (data.date_to ? parseDateKey(data.date_to) : fromKey);

    if (fromKey > toKey) {
      throw new Error('La data iniziale non può essere successiva alla data finale');
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        check_in_day: {
          gte: fromKey,
          lte: toKey,
        },
      },
      include: {
        member: true,
      },
      orderBy: {
        check_in_time: 'desc',
      },
      take: 1000,
    });

    const searchTerm = data.search.toLowerCase();
    const filtered = searchTerm
      ? attendances.filter((a) => {
          const member = getMemberSnapshot(a);
          const fullName = `${member.first_name} ${member.last_name}`.toLowerCase();
          const memberNumber = member.member_number.toLowerCase();
          return fullName.includes(searchTerm) || memberNumber.includes(searchTerm);
        })
      : attendances;

    return filtered.map((a) => ({
      id: a.id,
      check_in_time: a.check_in_time.toISOString(),
      check_in_day: a.check_in_day,
      member: getMemberSnapshot(a),
    }));
  });

// Admin-guarded: Monthly summary for current expiries and previous completed attendance month
export const getMonthlySummaryFn = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      expiry_month_offset: typeof data.expiry_month_offset === 'number' ? data.expiry_month_offset : 0,
      attendance_month_offset: typeof data.attendance_month_offset === 'number' ? data.attendance_month_offset : -1,
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests
    await assertAdminAllowed(user.id, 'general');

    const expiryOffset = data.expiry_month_offset;
    const attendanceOffset = data.attendance_month_offset;

    const now = new Date();
    const expiryMonthStart = new Date(now.getFullYear(), now.getMonth() + expiryOffset, 1);
    const expiryMonthEnd = new Date(now.getFullYear(), now.getMonth() + expiryOffset + 1, 1);
    const attendanceMonthStart = new Date(now.getFullYear(), now.getMonth() + attendanceOffset, 1);
    const attendanceMonthEnd = new Date(now.getFullYear(), now.getMonth() + attendanceOffset + 1, 1);
    const expiryMonthLabel = expiryMonthStart.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    });
    const attendanceMonthLabel = attendanceMonthStart.toLocaleDateString('it-IT', {
      month: 'long',
      year: 'numeric',
    });
    const expiryMonthKey = `${expiryMonthStart.getFullYear()}-${String(expiryMonthStart.getMonth() + 1).padStart(2, '0')}`;
    const attendanceMonthKey = `${attendanceMonthStart.getFullYear()}-${String(attendanceMonthStart.getMonth() + 1).padStart(2, '0')}`;

    const expiringMembers = await prisma.member.findMany({
      where: {
        role: { is: { role: 'user' } },
        expiry_date: {
          gte: expiryMonthStart,
          lt: expiryMonthEnd,
        },
      },
      orderBy: [
        { expiry_date: 'asc' },
        { last_name: 'asc' },
      ],
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        check_in_day: {
          gte: getLocalDateKey(attendanceMonthStart),
          lt: getLocalDateKey(attendanceMonthEnd),
        },
      },
      include: {
        member: true,
      },
      orderBy: [
        { check_in_day: 'asc' },
        { check_in_time: 'asc' },
      ],
      take: 5000,
    });

    const eventMap = new Map<string, {
      date: string;
      attendance_count: number;
      members: Array<{
        id: string;
        first_name: string;
        last_name: string;
        member_number: string;
        deleted: boolean;
        check_in_time: string;
      }>;
    }>();

    for (const attendance of attendances) {
      const member = getMemberSnapshot(attendance);
      const event = eventMap.get(attendance.check_in_day) ?? {
        date: attendance.check_in_day,
        attendance_count: 0,
        members: [],
      };

      event.attendance_count += 1;
      event.members.push({
        ...member,
        check_in_time: attendance.check_in_time.toISOString(),
      });
      eventMap.set(attendance.check_in_day, event);
    }

    return {
      id: `summary-${expiryMonthKey}-${attendanceMonthKey}`,
      title: `Riepilogo ${expiryMonthLabel}`,
      generated_at: now.toISOString(),
      expiry: {
        month_key: expiryMonthKey,
        month_label: expiryMonthLabel,
        period_start: expiryMonthStart.toISOString(),
        period_end: expiryMonthEnd.toISOString(),
        members: expiringMembers.map((member) => ({
          id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          member_number: member.member_number ?? '',
          joined_at: member.joined_at.toISOString(),
          expiry_date: member.expiry_date?.toISOString() ?? '',
        })),
      },
      attendance: {
        month_key: attendanceMonthKey,
        month_label: attendanceMonthLabel,
        period_start: attendanceMonthStart.toISOString(),
        period_end: attendanceMonthEnd.toISOString(),
        is_closed: attendanceOffset < 0,
        total_attendances: attendances.length,
        events: Array.from(eventMap.values()),
      },
    };
  });

// Admin-guarded: Delete attendance check-in
export const deleteAttendanceFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    return {
      attendance_id: requiredString(data, 'attendance_id', 120),
    };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests (sensitive operation)
    await assertAdminAllowed(user.id, 'sensitive');

    await prisma.attendance.delete({
      where: { id: data.attendance_id },
    });

    return { success: true };
  });

export const exportBackupFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests (sensitive operation)
    await assertAdminAllowed(user.id, 'sensitive');

    const [members, attendances] = await Promise.all([
      prisma.member.findMany({
        include: { role: true },
        orderBy: [
          { role: { role: 'asc' } },
          { last_name: 'asc' },
          { first_name: 'asc' },
        ],
      }),
      prisma.attendance.findMany({
        orderBy: [
          { check_in_day: 'asc' },
          { check_in_time: 'asc' },
        ],
      }),
    ]);

    const exportedAt = new Date().toISOString();
    const backup = {
      application: BACKUP_APPLICATION,
      version: 1,
      exported_at: exportedAt,
      notes: 'Backup standard: contiene anagrafica soci, token QR, ruoli, dati recupero non segreti e storico presenze. NON contiene hash password né hash risposta di recupero.',
      data: {
        members: members.map((member) => ({
          id: member.id,
          first_name: member.first_name,
          last_name: member.last_name,
          member_number: member.member_number,
          qr_token: member.qr_token,
          username: member.username,
          recovery_question: member.recovery_question,
          joined_at: member.joined_at.toISOString(),
          expiry_date: member.expiry_date?.toISOString() ?? null,
          password_changed: member.password_changed,
          must_setup: member.must_setup,
          has_recovery_answer: Boolean(member.recovery_phrase_hash),
          role: member.role
            ? {
                id: member.role.id,
                role: member.role.role,
              }
            : null,
        })),
        attendances: attendances.map((attendance) => ({
          id: attendance.id,
          member_id: attendance.member_id,
          check_in_time: attendance.check_in_time.toISOString(),
          check_in_day: attendance.check_in_day,
          member_first_name: attendance.member_first_name,
          member_last_name: attendance.member_last_name,
          member_number: attendance.member_number,
          member_was_deleted: attendance.member_was_deleted,
        })),
      },
    };

    const memberCsv = toCsv(
      [
        'id',
        'role',
        'first_name',
        'last_name',
        'member_number',
        'username',
        'recovery_question',
        'joined_at',
        'expiry_date',
        'password_changed',
        'must_setup',
        'qr_token',
        'has_recovery_answer',
      ],
      backup.data.members.map((member) => [
        member.id,
        member.role?.role ?? '',
        member.first_name,
        member.last_name,
        member.member_number ?? '',
        member.username,
        member.recovery_question ?? '',
        member.joined_at,
        member.expiry_date ?? '',
        member.password_changed,
        member.must_setup,
        member.qr_token ?? '',
        member.has_recovery_answer,
      ])
    );

    const attendanceCsv = toCsv(
      [
        'id',
        'member_id',
        'check_in_day',
        'check_in_time',
        'member_first_name',
        'member_last_name',
        'member_number',
        'member_was_deleted',
      ],
      backup.data.attendances.map((attendance) => [
        attendance.id,
        attendance.member_id ?? '',
        attendance.check_in_day,
        attendance.check_in_time,
        attendance.member_first_name,
        attendance.member_last_name,
        attendance.member_number,
        attendance.member_was_deleted,
      ])
    );

    return {
      exported_at: exportedAt,
      backup,
      csv: {
        members: memberCsv,
        attendances: attendanceCsv,
      },
      counts: {
        members: members.length,
        attendances: attendances.length,
      },
    };
  });

export const restoreBackupFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    assertRecord(data);
    const backupText = data.backup;
    if (typeof backupText !== 'string' || backupText.length < 20) {
      throw new Error('File backup non valido');
    }

    if (Buffer.byteLength(backupText, 'utf8') > MAX_BACKUP_BYTES) {
      throw new Error('Backup troppo grande');
    }

    return { backup: backupText };
  })
  .handler(async ({ data }) => {
    const user = await getAuthenticatedUser();
    assertReadyAdmin(user);

    // Rate limit admin requests (sensitive operation)
    await assertAdminAllowed(user.id, 'sensitive');

    let parsed: unknown;
    try {
      parsed = JSON.parse(data.backup);
    } catch {
      throw new Error('Il file selezionato non e un backup JSON valido');
    }

    assertRecord(parsed);
    if (
      (parsed.application !== BACKUP_APPLICATION && parsed.application !== LEGACY_BACKUP_APPLICATION) ||
      parsed.version !== 1
    ) {
      throw new Error('Backup non compatibile con questa applicazione');
    }

    const backupData = parsed.data;
    assertRecord(backupData);
    const members = backupData.members;
    const attendances = backupData.attendances;

    if (!Array.isArray(members) || !Array.isArray(attendances)) {
      throw new Error('Backup incompleto: mancano soci o presenze');
    }

    if (members.length === 0 || members.length > MAX_BACKUP_MEMBERS) {
      throw new Error('Backup non valido: numero soci fuori limite');
    }

    if (attendances.length > MAX_BACKUP_ATTENDANCES) {
      throw new Error('Backup non valido: numero presenze fuori limite');
    }

    const memberInputs = members.map((rawMember) => {
      assertRecord(rawMember);

      const role = rawMember.role;
      if (!role || typeof role !== 'object') {
        throw new Error('Backup non valido: ruolo mancante');
      }
      assertRecord(role);

      const roleValue = requiredString(role, 'role', 20);
      assertAllowedRole(roleValue);

      // Support both old (full) and new (standard) backup formats
      // New format: has_recovery_answer boolean, no password/recovery_phrase_hash
      // Old format: password and recovery_phrase_hash strings
      const hasPassword = typeof rawMember.password === 'string' && rawMember.password.length > 0;
      const hasRecoveryHash = typeof rawMember.recovery_phrase_hash === 'string' && rawMember.recovery_phrase_hash.length > 0;
      const isFullBackup = hasPassword || hasRecoveryHash;

      let password: string;
      const recoveryQuestion = nullableString(rawMember, 'recovery_question', 120);
      let recoveryPhraseHash: string | null = null;

      if (isFullBackup) {
        // Full backup (legacy/migration) - requires password and optionally recovery_phrase_hash
        password = requiredString(rawMember, 'password', 500);
        assertPasswordHash(password);
        const rph = nullableString(rawMember, 'recovery_phrase_hash', 500);
        if (rph) {
          assertPasswordHash(rph);
          recoveryPhraseHash = rph;
        }
      } else {
        // Standard backup - generate new secure password, no recovery answer
        password = hashPassword(generateTemporaryPassword(16));
        // recoveryPhraseHash remains null
      }

      return {
        id: requiredString(rawMember, 'id', 120),
        first_name: requiredString(rawMember, 'first_name', 80),
        last_name: requiredString(rawMember, 'last_name', 80),
        member_number: nullableString(rawMember, 'member_number', 80),
        qr_token: nullableString(rawMember, 'qr_token', 120),
        username: requiredString(rawMember, 'username', 80).toLowerCase(),
        password,
        recovery_question: recoveryQuestion,
        recovery_phrase_hash: recoveryPhraseHash,
        joined_at: requiredDateString(rawMember, 'joined_at'),
        expiry_date: optionalDateString(rawMember, 'expiry_date') ?? null,
        password_changed: isFullBackup ? Boolean(rawMember.password_changed) : false,
        must_setup: isFullBackup ? Boolean(rawMember.must_setup) : true,
        credentials_from_backup: isFullBackup,
        role: {
          id: requiredString(role, 'id', 120),
          role: roleValue,
        },
      };
    });

    assertUniqueValues(memberInputs.map((member) => member.id), 'id soci');
    assertUniqueValues(memberInputs.map((member) => member.username), 'username soci');
    assertUniqueValues(
      memberInputs.map((member) => member.member_number).filter((value): value is string => Boolean(value)),
      'numeri tessera'
    );
    assertUniqueValues(
      memberInputs.map((member) => member.qr_token).filter((value): value is string => Boolean(value)),
      'token QR'
    );
    assertUniqueValues(memberInputs.map((member) => member.role.id), 'id ruoli');

    const adminCount = memberInputs.filter((member) => member.role.role === 'admin').length;
    if (adminCount !== 1) {
      throw new Error('Il backup deve contenere esattamente un account amministratore');
    }

    const memberIds = new Set(memberInputs.map((member) => member.id));
    const attendanceInputs = attendances.map((rawAttendance) => {
      assertRecord(rawAttendance);
      const memberId = typeof rawAttendance.member_id === 'string' && memberIds.has(rawAttendance.member_id)
        ? rawAttendance.member_id
        : null;

      return {
        id: requiredString(rawAttendance, 'id', 120),
        member_id: memberId,
        check_in_time: requiredDateString(rawAttendance, 'check_in_time'),
        check_in_day: requiredString(rawAttendance, 'check_in_day', 20),
        member_first_name: requiredString(rawAttendance, 'member_first_name', 80),
        member_last_name: requiredString(rawAttendance, 'member_last_name', 80),
        member_number: requiredString(rawAttendance, 'member_number', 80),
        member_was_deleted: Boolean(rawAttendance.member_was_deleted) || !memberId,
      };
    });

    assertUniqueValues(attendanceInputs.map((attendance) => attendance.id), 'id presenze');
    assertUniqueValues(
      attendanceInputs
        .filter((attendance) => attendance.member_id)
        .map((attendance) => `${attendance.member_id}:${attendance.check_in_day}`),
      'presenze giornaliere'
    );

    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany();
      await tx.attendance.deleteMany();
      await tx.userRole.deleteMany();
      await tx.member.deleteMany();

      for (const member of memberInputs) {
        await tx.member.create({
          data: {
            id: member.id,
            first_name: member.first_name,
            last_name: member.last_name,
            member_number: member.member_number,
            qr_token: member.qr_token,
            username: member.username,
            password: member.password,
            recovery_question: member.recovery_question,
            recovery_phrase_hash: member.recovery_phrase_hash,
            joined_at: new Date(member.joined_at),
            expiry_date: member.expiry_date ? new Date(member.expiry_date) : null,
            password_changed: member.password_changed,
            must_setup: member.must_setup,
            ...(member.role
              ? {
                  role: {
                    create: {
                      id: member.role.id,
                      role: member.role.role,
                    },
                  },
                }
              : {}),
          },
        });
      }

      for (const attendance of attendanceInputs) {
        await tx.attendance.create({
          data: {
            id: attendance.id,
            member_id: attendance.member_id,
            check_in_time: new Date(attendance.check_in_time),
            check_in_day: attendance.check_in_day,
            member_first_name: attendance.member_first_name,
            member_last_name: attendance.member_last_name,
            member_number: attendance.member_number,
            member_was_deleted: attendance.member_was_deleted,
          },
        });
      }
    });

    const restoredAdmin = memberInputs.find((member) => member.role?.role === 'admin');
    const currentAdminRestored = restoredAdmin?.id === user.id;
    const restoredAdminNeedsSetup = Boolean(restoredAdmin && !restoredAdmin.credentials_from_backup);
    if (currentAdminRestored || restoredAdminNeedsSetup) {
      await setSession(restoredAdmin!.id);
    }

    return {
      success: true,
      keptSession: Boolean(currentAdminRestored || restoredAdminNeedsSetup),
      restored: {
        members: memberInputs.length,
        attendances: attendanceInputs.length,
      },
    };
  });
