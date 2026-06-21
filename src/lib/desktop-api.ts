type Role = 'admin' | 'user'

type DesktopMember = {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
  qr_token: string | null
  username: string
  password_hash: string
  recovery_question: string | null
  recovery_phrase_hash: string | null
  joined_at: string
  expiry_date: string | null
  password_changed: boolean
  must_setup: boolean
  role: Role
}

type DesktopAttendance = {
  id: string
  member_id: string | null
  check_in_time: string
  check_in_day: string
  member_first_name: string
  member_last_name: string
  member_number: string
  member_was_deleted: boolean
}

type DesktopDb = {
  version: 1
  current_user_id: string | null
  members: DesktopMember[]
  attendances: DesktopAttendance[]
}

const DB_KEY = 'the-club:desktop-db'
const LEGACY_DB_KEY = 'gestore-pub:desktop-db'
const BACKUP_APPLICATION = 'the-club'
const LEGACY_BACKUP_APPLICATION = 'gestore-pub'
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
const DEFAULT_RECOVERY_QUESTION = 'Qual e la tua risposta di recupero?'
const MAX_BACKUP_BYTES = 20 * 1024 * 1024
const MAX_BACKUP_MEMBERS = 10000
const MAX_BACKUP_ATTENDANCES = 250000

type FnArgs = { data?: Record<string, unknown> } | undefined
type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>
type StoredDbSource = 'tauri-file' | 'legacy-localStorage' | 'localStorage' | 'empty'

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') return null

  return (window as typeof window & {
    __TAURI__?: {
      core?: {
        invoke?: TauriInvoke
      }
    }
  }).__TAURI__?.core?.invoke ?? null
}

async function readStoredDbRaw(): Promise<{ raw: string | null; source: StoredDbSource }> {
  const invoke = getTauriInvoke()
  const localRaw = localStorage.getItem(DB_KEY) ?? localStorage.getItem(LEGACY_DB_KEY)

  if (invoke) {
    const raw = await invoke<string | null>('read_desktop_db')
    if (raw) return { raw, source: 'tauri-file' }

    return {
      raw: localRaw,
      source: localRaw ? 'legacy-localStorage' : 'empty',
    }
  }

  return {
    raw: localRaw,
    source: localRaw ? 'localStorage' : 'empty',
  }
}

async function persistDb(db: DesktopDb) {
  const raw = JSON.stringify(db)
  const invoke = getTauriInvoke()

  if (invoke) {
    await invoke('write_desktop_db', { contents: raw })
    return
  }

  localStorage.setItem(DB_KEY, raw)
}

async function migrateLegacyLocalDb(db: DesktopDb) {
  await persistDb(db)
  localStorage.removeItem(DB_KEY)
  localStorage.removeItem(LEGACY_DB_KEY)
}

export async function resetDesktopDatabase() {
  const invoke = getTauriInvoke()

  if (invoke) {
    await invoke('reset_desktop_db')
  }

  localStorage.removeItem(DB_KEY)
  localStorage.removeItem(LEGACY_DB_KEY)
}

export async function cleanupAppData(): Promise<string | null> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<string>('cleanup_app_data')
  }

  // Web fallback: just clear localStorage
  localStorage.removeItem(DB_KEY)
  localStorage.removeItem(LEGACY_DB_KEY)
  return 'Dati locali (localStorage) rimossi.'
}

export async function openExternalUrl(url: string): Promise<boolean> {
  const invoke = getTauriInvoke()

  if (invoke) {
    try {
      await invoke('open_external_url', { url })
      return true
    } catch {
      return false
    }
  }

  // Web fallback: window.open
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export async function resetLocalDatabaseFn() {
  await resetDesktopDatabase()
  return { success: true }
}

function getData(args?: FnArgs) {
  return args?.data ?? {}
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new Error('Input non valido')
  }
}

function requiredString(data: Record<string, unknown>, key: string, maxLength = 255) {
  const value = data[key]
  if (typeof value !== 'string') throw new Error('Input non valido')
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) throw new Error('Input non valido')
  return trimmed
}

function optionalDateString(data: Record<string, unknown>, key: string) {
  const value = data[key]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('Data non valida')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Data non valida')
  return value
}

function requiredDateString(data: Record<string, unknown>, key: string) {
  const value = optionalDateString(data, key)
  if (!value) throw new Error('Data non valida')
  return value
}

function nullableString(data: Record<string, unknown>, key: string, maxLength = 255) {
  const value = data[key]
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Input non valido')
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) throw new Error('Input non valido')
  return trimmed
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomHex(bytesLength = 16) {
  const bytes = new Uint8Array(bytesLength)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function digestPassword(password: string, salt = randomToken()) {
  if (!crypto.subtle) {
    throw new Error('Le API crittografiche Web Crypto non sono supportate in questo ambiente.')
  }

  const pbkdf2Salt = /^[a-f0-9]{32}$/i.test(salt) ? salt : randomHex()
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(pbkdf2Salt),
      iterations: 310000,
      hash: 'SHA-512',
    },
    key,
    512,
  )
  return `pbkdf2_sha512$310000$${pbkdf2Salt}$${toHex(bits)}`
}

async function verifyPbkdf2Password(password: string, iterations: number, salt: string, expectedHash: string) {
  if (!crypto.subtle) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations,
      hash: 'SHA-512',
    },
    key,
    512,
  )
  return timingSafeEqual(toHex(bits), expectedHash.toLowerCase())
}

async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('pbkdf2_sha512$')) {
    const [, iterationsValue, salt, hash] = storedHash.split('$')
    const iterations = Number(iterationsValue)
    return Number.isInteger(iterations) && iterations > 0 && iterations <= 1000000 && Boolean(salt) && Boolean(hash)
      ? verifyPbkdf2Password(password, iterations, salt, hash)
      : false
  }

  if (storedHash.includes(':')) {
    const [salt, hash] = storedHash.split(':')
    return salt && hash ? verifyPbkdf2Password(password, 1000, salt, hash) : false
  }

  const [kind, salt, hash] = storedHash.split('$')
  if (!kind || !salt || !hash) return false
  if (kind === 'sha256') {
    if (!crypto.subtle) return false
    const encoded = new TextEncoder().encode(`${salt}:${password}`)
    const currentHash = await crypto.subtle.digest('SHA-256', encoded)
    return timingSafeEqual(toHex(currentHash), hash.toLowerCase())
  }
  if (kind === 'local') {
    return timingSafeEqual(btoa(`${salt}:${password}`), hash)
  }
  return timingSafeEqual(await digestPassword(password, salt), storedHash)
}

function parseDb(raw: string | null): DesktopDb | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DesktopDb
    if (parsed.version !== 1 || !Array.isArray(parsed.members) || !Array.isArray(parsed.attendances)) {
      return null
    }
    parsed.members = parsed.members.map((member) => ({
      ...member,
      recovery_question: member.recovery_question ?? null,
      recovery_phrase_hash: member.recovery_phrase_hash ?? null,
    }))
    return parsed
  } catch {
    return null
  }
}

async function createInitialDb(): Promise<DesktopDb> {
  const now = new Date().toISOString()
  const adminId = randomId()
  return {
    version: 1,
    current_user_id: adminId,
    members: [
      {
        id: adminId,
        first_name: 'Admin',
        last_name: 'Club',
        member_number: null,
        qr_token: null,
        username: 'admin',
        password_hash: await digestPassword(randomToken()),
        recovery_question: null,
        recovery_phrase_hash: null,
        joined_at: now,
        expiry_date: null,
        password_changed: false,
        must_setup: true,
        role: 'admin',
      },
    ],
    attendances: [],
  }
}

async function loadDb() {
  const stored = await readStoredDbRaw()
  let db = parseDb(stored.raw)

  if (stored.raw && !db && stored.source === 'tauri-file') {
    throw new Error('Database locale non valido. Ripristina un backup oppure usa il reset app se vuoi ripartire da zero.')
  }

  if (db && stored.source === 'legacy-localStorage') {
    await migrateLegacyLocalDb(db)
  }

  if (!db || !db.members.some((member) => member.role === 'admin')) {
    db = await createInitialDb()
    await saveDb(db)
    return db
  }

  const bootstrapAdmin = db.members.length === 1 && db.members[0].role === 'admin'
    ? db.members[0]
    : null

  if (
    bootstrapAdmin &&
    !db.current_user_id &&
    (bootstrapAdmin.must_setup || !bootstrapAdmin.password_changed || !bootstrapAdmin.recovery_question || !bootstrapAdmin.recovery_phrase_hash)
  ) {
    db.current_user_id = bootstrapAdmin.id
    await saveDb(db)
  }

  return db
}

async function saveDb(db: DesktopDb) {
  await persistDb(db)
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Data non valida')
  return getLocalDateKey(date)
}

function addMembershipYear(value: Date) {
  return new Date(value.getTime() + 365 * 24 * 60 * 60 * 1000)
}

function publicUser(member: DesktopMember) {
  return {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: member.member_number,
    qr_token: member.qr_token,
    username: member.username,
    joined_at: member.joined_at,
    expiry_date: member.expiry_date,
    password_changed: member.password_changed,
    must_setup: member.must_setup,
    role: member.role,
  }
}

function memberSnapshot(db: DesktopDb, attendance: DesktopAttendance) {
  const member = attendance.member_id
    ? db.members.find((candidate) => candidate.id === attendance.member_id)
    : null

  return {
    id: member?.id ?? attendance.member_id ?? '',
    first_name: member?.first_name ?? attendance.member_first_name,
    last_name: member?.last_name ?? attendance.member_last_name,
    member_number: member?.member_number ?? attendance.member_number,
    deleted: attendance.member_was_deleted || !member,
  }
}

function getCurrentMember(db: DesktopDb) {
  if (!db.current_user_id) return null
  const member = db.members.find((member) => member.id === db.current_user_id) ?? null
  if (!member) {
    db.current_user_id = null
  }
  return member
}

function assertReadyAdmin(db: DesktopDb) {
  const user = getCurrentMember(db)
  if (!user || user.role !== 'admin') throw new Error('Accesso non autorizzato')
  if (user.must_setup || !user.password_changed) {
    throw new Error("Completa prima la configurazione dell'account amministratore")
  }
  return user
}

function assertStrongPassword(password: string, message: string) {
  if (!PASSWORD_REGEX.test(password)) throw new Error(message)
}

function normalizeRecoveryQuestion(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeRecoveryAnswer(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalizeLegacyRecoveryPhrase(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function assertRecoveryQuestion(question: string) {
  const normalized = normalizeRecoveryQuestion(question)
  if (normalized.length < 6 || normalized.length > 120) {
    throw new Error('La domanda di recupero deve contenere tra 6 e 120 caratteri.')
  }
}

function assertRecoveryAnswer(answer: string) {
  const normalized = normalizeRecoveryAnswer(answer)
  const wordCount = normalized.split(' ').filter(Boolean).length
  if (normalized.length < 2 || normalized.length > 80 || wordCount > 4) {
    throw new Error('La risposta di recupero deve contenere da 1 a 4 parole.')
  }
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n')
}

export async function loginFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const username = requiredString(data, 'username', 80).toLowerCase()
  const password = requiredString(data, 'password', 256)
  const db = await loadDb()
  const member = db.members.find((candidate) => candidate.username.toLowerCase() === username)

  if (!member || !(await verifyPassword(password, member.password_hash))) {
    throw new Error('Credenziali non valide')
  }

  db.current_user_id = member.id
  await saveDb(db)

  return {
    success: true,
    mustSetup: member.must_setup || !member.password_changed,
    role: member.role,
  }
}

export async function logoutFn() {
  const db = await loadDb()
  db.current_user_id = null
  await saveDb(db)
  return { success: true }
}

export async function getCurrentUserFn() {
  const db = await loadDb()
  const member = getCurrentMember(db)
  return member ? publicUser(member) : null
}

export async function setupValidator(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const user = getCurrentMember(db)
  if (!user) throw new Error('Non sei autenticato')

  const username = requiredString(data, 'username', 80).toLowerCase()
  const password = requiredString(data, 'password', 256)
  const recoveryQuestion = requiredString(data, 'recovery_question', 120)
  const recoveryAnswer = requiredString(data, 'recovery_answer', 80)
  if (username.length < 3) throw new Error('Lo username deve contenere almeno 3 caratteri.')
  assertStrongPassword(password, 'La password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.')
  assertRecoveryQuestion(recoveryQuestion)
  assertRecoveryAnswer(recoveryAnswer)

  if (db.members.some((member) => member.id !== user.id && member.username.toLowerCase() === username)) {
    throw new Error('Questo username è già in uso.')
  }

  user.username = username
  user.password_hash = await digestPassword(password)
  user.recovery_question = normalizeRecoveryQuestion(recoveryQuestion)
  user.recovery_phrase_hash = await digestPassword(normalizeRecoveryAnswer(recoveryAnswer))
  user.password_changed = true
  user.must_setup = false
  await saveDb(db)
  return { success: true, role: user.role }
}

export async function changeAdminPasswordFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const admin = assertReadyAdmin(db)
  const currentPassword = requiredString(data, 'current_password', 256)
  const newPassword = requiredString(data, 'new_password', 256)

  if (!(await verifyPassword(currentPassword, admin.password_hash))) {
    throw new Error('La password attuale non e corretta')
  }
  assertStrongPassword(newPassword, 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.')
  if (await verifyPassword(newPassword, admin.password_hash)) {
    throw new Error('La nuova password deve essere diversa da quella attuale')
  }

  admin.password_hash = await digestPassword(newPassword)
  admin.password_changed = true
  admin.must_setup = false
  await saveDb(db)
  return { success: true }
}

export async function changeAdminRecoveryPhraseFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const admin = assertReadyAdmin(db)
  const currentPassword = requiredString(data, 'current_password', 256)
  const recoveryQuestion = requiredString(data, 'recovery_question', 120)
  const recoveryAnswer = requiredString(data, 'recovery_answer', 80)

  if (!(await verifyPassword(currentPassword, admin.password_hash))) {
    throw new Error('La password attuale non e corretta')
  }

  assertRecoveryQuestion(recoveryQuestion)
  assertRecoveryAnswer(recoveryAnswer)
  admin.recovery_question = normalizeRecoveryQuestion(recoveryQuestion)
  admin.recovery_phrase_hash = await digestPassword(normalizeRecoveryAnswer(recoveryAnswer))
  await saveDb(db)
  return { success: true }
}

export async function getRecoveryQuestionFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const username = requiredString(data, 'username', 80).toLowerCase()
  const member = db.members.find((candidate) => candidate.username.toLowerCase() === username)
  return {
    question: member?.recovery_phrase_hash ? member.recovery_question || DEFAULT_RECOVERY_QUESTION : null,
  }
}

export async function recoverPasswordFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const username = requiredString(data, 'username', 80).toLowerCase()
  const recoveryAnswer = requiredString(data, 'recovery_answer', 500)
  const newPassword = requiredString(data, 'new_password', 256)
  const member = db.members.find((candidate) => candidate.username.toLowerCase() === username)

  assertStrongPassword(newPassword, 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.')
  if (member?.recovery_question) {
    assertRecoveryAnswer(recoveryAnswer)
  }

  if (
    !member ||
    !member.recovery_phrase_hash ||
    !(
      (await verifyPassword(normalizeRecoveryAnswer(recoveryAnswer), member.recovery_phrase_hash)) ||
      (await verifyPassword(normalizeLegacyRecoveryPhrase(recoveryAnswer), member.recovery_phrase_hash))
    )
  ) {
    throw new Error('Username o risposta di recupero non validi.')
  }

  if (await verifyPassword(newPassword, member.password_hash)) {
    throw new Error('La nuova password deve essere diversa da quella attuale')
  }

  member.password_hash = await digestPassword(newPassword)
  member.password_changed = true
  member.must_setup = false
  db.current_user_id = member.id
  await saveDb(db)
  return { success: true, role: member.role }
}

export async function getAllMembersFn() {
  const db = await loadDb()
  assertReadyAdmin(db)
  return db.members
    .filter((member) => member.role === 'user')
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
    .map((member) => ({
      ...publicUser(member),
      member_number: member.member_number ?? '',
      qr_token: member.qr_token ?? '',
      expiry_date: member.expiry_date ?? '',
    }))
}

export async function getCheckInMembersFn() {
  const db = await loadDb()
  assertReadyAdmin(db)
  return db.members
    .filter((member) => member.role === 'user')
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
    .map((member) => ({
      id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      member_number: member.member_number ?? '',
      expiry_date: member.expiry_date ?? '',
    }))
}

export async function createMemberFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)

  const firstName = requiredString(data, 'first_name', 80)
  const lastName = requiredString(data, 'last_name', 80)
  const memberNumber = requiredString(data, 'member_number', 80).toUpperCase()
  const startDateValue = optionalDateString(data, 'start_date')

  if (db.members.some((member) => member.member_number === memberNumber)) {
    throw new Error('Questo numero tessera e gia in uso')
  }

  const baseUsername = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}`
  let username = baseUsername
  let counter = 1
  while (db.members.some((member) => member.username === username)) {
    username = `${baseUsername}${counter++}`
  }

  const temporaryPassword = randomToken().slice(0, 12) + 'Aa1!'
  const joinedAt = startDateValue ? new Date(startDateValue) : new Date()
  const expiryDate = addMembershipYear(joinedAt)
  const member: DesktopMember = {
    id: randomId(),
    first_name: firstName,
    last_name: lastName,
    member_number: memberNumber,
    qr_token: randomToken(),
    username,
    password_hash: await digestPassword(temporaryPassword),
    recovery_question: null,
    recovery_phrase_hash: null,
    joined_at: joinedAt.toISOString(),
    expiry_date: expiryDate.toISOString(),
    password_changed: false,
    must_setup: true,
    role: 'user',
  }

  db.members.push(member)
  await saveDb(db)

  return {
    success: true,
    id: member.id,
    username: member.username,
    password: temporaryPassword,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: member.member_number,
    qr_token: member.qr_token,
    joined_at: member.joined_at,
    expiry_date: member.expiry_date,
  }
}

export async function renewMembershipFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)

  const memberId = requiredString(data, 'member_id', 120)
  const startDateValue = optionalDateString(data, 'start_date')
  const member = db.members.find((member) => member.id === memberId)
  if (!member) throw new Error('Membro non trovato')
  if (member.role === 'admin') throw new Error("L'account amministratore non ha un abbonamento da rinnovare")

  const startDate = startDateValue ? new Date(startDateValue) : new Date()
  member.joined_at = startDate.toISOString()
  member.expiry_date = addMembershipYear(startDate).toISOString()
  await saveDb(db)
  return { success: true }
}

export async function deleteMemberFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const admin = assertReadyAdmin(db)
  const memberId = requiredString(data, 'member_id', 120)
  if (admin.id === memberId) throw new Error('Non puoi eliminare il tuo stesso account amministratore')

  db.attendances = db.attendances.map((attendance) => (
    attendance.member_id === memberId ? { ...attendance, member_was_deleted: true } : attendance
  ))
  db.members = db.members.filter((member) => member.id !== memberId)
  await saveDb(db)
  return { success: true }
}

export async function registerAttendanceFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)
  const codeValue = typeof data.identifier === 'string' ? data.identifier : data.member_id
  const code = requiredString({ code: codeValue }, 'code', 120)
  const member = db.members.find((candidate) => candidate.id === code || candidate.qr_token === code)

  if (!member) throw new Error('Membro non registrato o codice QR non valido')
  if (member.role === 'admin') throw new Error("L'account amministratore non usa tessere o check-in")
  if (!member.member_number || !member.expiry_date) {
    throw new Error('Tessera membro incompleta: numero tessera o scadenza mancanti')
  }

  const now = new Date()
  if (new Date(member.expiry_date) < now) {
    throw new Error(`Tessera scaduta il ${new Date(member.expiry_date).toLocaleDateString('it-IT')}`)
  }

  const checkInDay = getLocalDateKey(now)
  const duplicate = db.attendances.find((attendance) => attendance.member_id === member.id && attendance.check_in_day === checkInDay)
  const memberResult = {
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: member.member_number,
  }

  if (duplicate) {
    return { success: true, alreadyCheckedIn: true, member: memberResult }
  }

  db.attendances.push({
    id: randomId(),
    member_id: member.id,
    check_in_time: now.toISOString(),
    check_in_day: checkInDay,
    member_first_name: member.first_name,
    member_last_name: member.last_name,
    member_number: member.member_number,
    member_was_deleted: false,
  })
  await saveDb(db)
  return { success: true, alreadyCheckedIn: false, member: memberResult }
}

export async function getTodayAttendanceFn() {
  const db = await loadDb()
  assertReadyAdmin(db)
  const todayKey = getLocalDateKey()
  return db.attendances
    .filter((attendance) => attendance.check_in_day === todayKey)
    .sort((a, b) => b.check_in_time.localeCompare(a.check_in_time))
    .map((attendance) => ({
      id: attendance.id,
      check_in_time: attendance.check_in_time,
      member: memberSnapshot(db, attendance),
    }))
}

export async function getAttendanceLogsFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)

  const selectedDateKey = optionalDateString(data, 'date') ? parseDateKey(String(data.date)) : undefined
  const fromKey = selectedDateKey ?? (optionalDateString(data, 'date_from') ? parseDateKey(String(data.date_from)) : getLocalDateKey())
  const toKey = selectedDateKey ?? (optionalDateString(data, 'date_to') ? parseDateKey(String(data.date_to)) : fromKey)
  const search = typeof data.search === 'string' ? data.search.trim().toLowerCase().slice(0, 120) : ''

  if (fromKey > toKey) throw new Error('La data iniziale non puo essere successiva alla data finale')

  return db.attendances
    .filter((attendance) => attendance.check_in_day >= fromKey && attendance.check_in_day <= toKey)
    .filter((attendance) => {
      if (!search) return true
      const member = memberSnapshot(db, attendance)
      return `${member.first_name} ${member.last_name}`.toLowerCase().includes(search) ||
        member.member_number.toLowerCase().includes(search)
    })
    .sort((a, b) => b.check_in_time.localeCompare(a.check_in_time))
    .slice(0, 1000)
    .map((attendance) => ({
      id: attendance.id,
      check_in_time: attendance.check_in_time,
      check_in_day: attendance.check_in_day,
      member: memberSnapshot(db, attendance),
    }))
}

export async function getMonthlySummaryFn() {
  const db = await loadDb()
  assertReadyAdmin(db)

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthEnd = currentMonthStart
  const currentMonthKey = `${currentMonthStart.getFullYear()}-${String(currentMonthStart.getMonth() + 1).padStart(2, '0')}`
  const previousMonthKey = `${previousMonthStart.getFullYear()}-${String(previousMonthStart.getMonth() + 1).padStart(2, '0')}`
  const currentMonthLabel = currentMonthStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const previousMonthLabel = previousMonthStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  const previousStartKey = getLocalDateKey(previousMonthStart)
  const previousEndKey = getLocalDateKey(previousMonthEnd)

  const expiringMembers = db.members
    .filter((member) => member.role === 'user' && member.expiry_date)
    .filter((member) => {
      const expiry = new Date(member.expiry_date!)
      return expiry >= currentMonthStart && expiry < nextMonthStart
    })
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))

  const attendances = db.attendances
    .filter((attendance) => attendance.check_in_day >= previousStartKey && attendance.check_in_day < previousEndKey)
    .sort((a, b) => `${a.check_in_day} ${a.check_in_time}`.localeCompare(`${b.check_in_day} ${b.check_in_time}`))

  const eventMap = new Map<string, { date: string; attendance_count: number; members: Array<ReturnType<typeof memberSnapshot> & { check_in_time: string }> }>()
  for (const attendance of attendances) {
    const event = eventMap.get(attendance.check_in_day) ?? {
      date: attendance.check_in_day,
      attendance_count: 0,
      members: [],
    }
    event.attendance_count += 1
    event.members.push({ ...memberSnapshot(db, attendance), check_in_time: attendance.check_in_time })
    eventMap.set(attendance.check_in_day, event)
  }

  return {
    id: `summary-${currentMonthKey}`,
    title: `Riepilogo ${currentMonthLabel}`,
    generated_at: now.toISOString(),
    expiry: {
      month_key: currentMonthKey,
      month_label: currentMonthLabel,
      period_start: currentMonthStart.toISOString(),
      period_end: nextMonthStart.toISOString(),
      members: expiringMembers.map((member) => ({
        id: member.id,
        first_name: member.first_name,
        last_name: member.last_name,
        member_number: member.member_number ?? '',
        joined_at: member.joined_at,
        expiry_date: member.expiry_date ?? '',
      })),
    },
    attendance: {
      month_key: previousMonthKey,
      month_label: previousMonthLabel,
      period_start: previousMonthStart.toISOString(),
      period_end: previousMonthEnd.toISOString(),
      is_closed: true,
      total_attendances: attendances.length,
      events: Array.from(eventMap.values()),
    },
  }
}

export async function deleteAttendanceFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)
  const attendanceId = requiredString(data, 'attendance_id', 120)
  db.attendances = db.attendances.filter((attendance) => attendance.id !== attendanceId)
  await saveDb(db)
  return { success: true }
}

export async function exportBackupFn() {
  const db = await loadDb()
  assertReadyAdmin(db)
  const exportedAt = new Date().toISOString()
  const members = db.members.map((member) => ({
    id: member.id,
    first_name: member.first_name,
    last_name: member.last_name,
    member_number: member.member_number,
    qr_token: member.qr_token,
    username: member.username,
    recovery_question: member.recovery_question,
    joined_at: member.joined_at,
    expiry_date: member.expiry_date,
    password_changed: member.password_changed,
    must_setup: member.must_setup,
    has_recovery_answer: Boolean(member.recovery_phrase_hash),
    role: {
      id: `role-${member.id}`,
      role: member.role,
    },
  }))
  const backup = {
    application: BACKUP_APPLICATION,
    version: 1,
    exported_at: exportedAt,
    notes: 'Backup standard: contiene anagrafica soci, token QR, ruoli, dati recupero non segreti e storico presenze. NON contiene hash password né hash risposta di recupero.',
    data: {
      members,
      attendances: db.attendances,
    },
  }

  return {
    exported_at: exportedAt,
    backup,
    csv: {
      members: toCsv(
        ['id', 'role', 'first_name', 'last_name', 'member_number', 'username', 'recovery_question', 'joined_at', 'expiry_date', 'password_changed', 'must_setup', 'qr_token', 'has_recovery_answer'],
        members.map((member) => [
          member.id,
          member.role.role,
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
        ]),
      ),
      attendances: toCsv(
        ['id', 'member_id', 'check_in_day', 'check_in_time', 'member_first_name', 'member_last_name', 'member_number', 'member_was_deleted'],
        db.attendances.map((attendance) => [
          attendance.id,
          attendance.member_id ?? '',
          attendance.check_in_day,
          attendance.check_in_time,
          attendance.member_first_name,
          attendance.member_last_name,
          attendance.member_number,
          attendance.member_was_deleted,
        ]),
      ),
    },
    counts: {
      members: db.members.length,
      attendances: db.attendances.length,
    },
  }
}

function assertPasswordHash(value: string) {
  const modern = value.match(/^pbkdf2_sha512\$(\d+)\$([a-f0-9]{32,128})\$([a-f0-9]{128})$/i)
  if (modern) {
    const iterations = Number(modern[1])
    if (Number.isInteger(iterations) && iterations >= 100000 && iterations <= 1000000) {
      return
    }
  }

  const legacy = value.match(/^[a-f0-9]{16,128}:[a-f0-9]{128}$/i)
  if (legacy) return

  const sha256 = value.match(/^sha256\$[a-zA-Z0-9_-]+\$[a-f0-9]{64}$/i)
  if (sha256) return

  const local = value.match(/^local\$[a-zA-Z0-9_-]+\$[a-zA-Z0-9+/=]+$/i)
  if (local) return

  throw new Error('Backup non valido: hash password non riconosciuto o non sicuro')
}

function assertUniqueValues(values: string[], label: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Backup non valido: valore duplicato in ${label}`)
    }
    seen.add(value)
  }
}

export async function restoreBackupFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const rawBackupText = data.backup
  if (typeof rawBackupText !== 'string' || rawBackupText.length < 20) {
    throw new Error('File backup non valido')
  }
  const backupText = rawBackupText.trim()
  if (new TextEncoder().encode(backupText).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Backup troppo grande')
  }
  const db = await loadDb()
  const user = assertReadyAdmin(db)

  let parsed: any
  try {
    parsed = JSON.parse(backupText)
  } catch {
    throw new Error('Il file selezionato non e un backup JSON valido')
  }

  if (
    (parsed?.application !== BACKUP_APPLICATION && parsed?.application !== LEGACY_BACKUP_APPLICATION) ||
    parsed.version !== 1 ||
    !Array.isArray(parsed.data?.members) ||
    !Array.isArray(parsed.data?.attendances)
  ) {
    throw new Error('Backup non compatibile con questa applicazione')
  }

  if (parsed.data.members.length === 0 || parsed.data.members.length > MAX_BACKUP_MEMBERS) {
    throw new Error('Backup non valido: numero soci fuori limite')
  }

  if (parsed.data.attendances.length > MAX_BACKUP_ATTENDANCES) {
    throw new Error('Backup non valido: numero presenze fuori limite')
  }

  const restoredMembersWithFlags = await Promise.all(parsed.data.members.map(async (member: any) => {
    const roleValue = member.role?.role === 'admin' ? 'admin' : 'user'
    const hasPassword = typeof member.password === 'string' && member.password.length > 0
    const hasRecoveryHash = typeof member.recovery_phrase_hash === 'string' && member.recovery_phrase_hash.length > 0
    const isFullBackup = hasPassword || hasRecoveryHash

    let passwordHash: string
    let recoveryPhraseHash: string | null = null

    if (isFullBackup) {
      passwordHash = requiredString(member, 'password', 500)
      assertPasswordHash(passwordHash)
      const rph = nullableString(member, 'recovery_phrase_hash', 500)
      if (rph) {
        assertPasswordHash(rph)
        recoveryPhraseHash = rph
      }
    } else {
      const tempPassword = randomToken().slice(0, 16) + 'Aa1!'
      passwordHash = await digestPassword(tempPassword)
    }

    return {
      id: requiredString(member, 'id', 120),
      first_name: requiredString(member, 'first_name', 80),
      last_name: requiredString(member, 'last_name', 80),
      member_number: nullableString(member, 'member_number', 80),
      qr_token: nullableString(member, 'qr_token', 120),
      username: requiredString(member, 'username', 80).toLowerCase(),
      password_hash: passwordHash,
      recovery_question: nullableString(member, 'recovery_question', 120),
      recovery_phrase_hash: recoveryPhraseHash,
      joined_at: requiredDateString(member, 'joined_at'),
      expiry_date: optionalDateString(member, 'expiry_date') ?? null,
      password_changed: isFullBackup ? Boolean(member.password_changed) : false,
      must_setup: isFullBackup ? Boolean(member.must_setup) : true,
      role: roleValue as 'admin' | 'user',
      credentials_from_backup: isFullBackup,
    }
  }))
  const restoredMembers: DesktopMember[] = restoredMembersWithFlags.map(({ credentials_from_backup: _credentialsFromBackup, ...member }) => member)

  assertUniqueValues(restoredMembers.map((m) => m.id), 'id soci')
  assertUniqueValues(restoredMembers.map((m) => m.username), 'username soci')
  assertUniqueValues(
    restoredMembers.map((m) => m.member_number).filter((v): v is string => Boolean(v)),
    'numeri tessera'
  )
  assertUniqueValues(
    restoredMembers.map((m) => m.qr_token).filter((v): v is string => Boolean(v)),
    'token QR'
  )

  const adminCount = restoredMembers.filter((m) => m.role === 'admin').length
  if (adminCount !== 1) {
    throw new Error('Il backup deve contenere esattamente un account amministratore')
  }

  const memberIds = new Set(restoredMembers.map((m) => m.id))
  const restoredAttendances: DesktopAttendance[] = parsed.data.attendances.map((attendance: Record<string, unknown>) => {
    const memberId = typeof attendance.member_id === 'string' && memberIds.has(attendance.member_id)
      ? attendance.member_id
      : null

    return {
      id: requiredString(attendance, 'id', 120),
      member_id: memberId,
      check_in_time: requiredDateString(attendance, 'check_in_time'),
      check_in_day: requiredString(attendance, 'check_in_day', 20),
      member_first_name: requiredString(attendance, 'member_first_name', 80),
      member_last_name: requiredString(attendance, 'member_last_name', 80),
      member_number: requiredString(attendance, 'member_number', 80),
      member_was_deleted: Boolean(attendance.member_was_deleted) || !memberId,
    }
  })

  assertUniqueValues(restoredAttendances.map((attendance) => attendance.id), 'id presenze')
  assertUniqueValues(
    restoredAttendances
      .filter((attendance) => attendance.member_id)
      .map((attendance) => `${attendance.member_id}:${attendance.check_in_day}`),
    'presenze giornaliere'
  )

  const restoredDb: DesktopDb = {
    version: 1,
    current_user_id: null,
    members: restoredMembers,
    attendances: restoredAttendances,
  }

  const restoredAdmin = restoredMembersWithFlags.find((member) => member.role === 'admin')
  const currentAdminRestored = restoredAdmin?.id === user.id
  const restoredAdminNeedsSetup = Boolean(restoredAdmin && !restoredAdmin.credentials_from_backup)
  restoredDb.current_user_id = currentAdminRestored || restoredAdminNeedsSetup ? restoredAdmin?.id ?? null : null
  await saveDb(restoredDb)

  return {
    success: true,
    keptSession: Boolean(restoredDb.current_user_id),
    restored: {
      members: restoredDb.members.length,
      attendances: restoredDb.attendances.length,
    },
  }
}
