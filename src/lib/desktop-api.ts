type Role = 'admin' | 'user'

type DesktopMember = {
  id: string
  first_name: string
  last_name: string
  member_number: string | null
  qr_token: string | null
  username: string
  password_hash: string
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

const DB_KEY = 'gestore-pub:desktop-db'
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/

type FnArgs = { data?: Record<string, unknown> } | undefined

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

async function digestPassword(password: string, salt = randomToken()) {
  if (crypto.subtle) {
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

  if (!crypto.subtle) {
    return `local$${salt}$${btoa(`${salt}:${password}`)}`
  }

  const encoded = new TextEncoder().encode(`${salt}:${password}`)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return `sha256$${salt}$${toHex(hash)}`
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
  return toHex(bits) === expectedHash.toLowerCase()
}

async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith('pbkdf2_sha512$')) {
    const [, iterationsValue, salt, hash] = storedHash.split('$')
    const iterations = Number(iterationsValue)
    return Number.isInteger(iterations) && iterations > 0 && Boolean(salt) && Boolean(hash)
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
    return toHex(currentHash) === hash.toLowerCase()
  }
  if (kind === 'local') {
    return btoa(`${salt}:${password}`) === hash
  }
  return await digestPassword(password, salt) === storedHash
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
  let db = parseDb(localStorage.getItem(DB_KEY))
  if (!db || !db.members.some((member) => member.role === 'admin')) {
    db = await createInitialDb()
    saveDb(db)
    return db
  }

  const bootstrapAdmin = db.members.length === 1 && db.members[0].role === 'admin'
    ? db.members[0]
    : null

  if (
    bootstrapAdmin &&
    !db.current_user_id &&
    (bootstrapAdmin.must_setup || !bootstrapAdmin.password_changed || !bootstrapAdmin.recovery_phrase_hash)
  ) {
    db.current_user_id = bootstrapAdmin.id
    saveDb(db)
  }

  return db
}

function saveDb(db: DesktopDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
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
    saveDb(db)
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

function normalizeRecoveryPhrase(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function assertStrongRecoveryPhrase(phrase: string) {
  const normalized = normalizeRecoveryPhrase(phrase)
  const wordCount = normalized.split(' ').filter(Boolean).length
  if (normalized.length < 16 || wordCount < 3) {
    throw new Error('La frase di recupero deve contenere almeno 3 parole e 16 caratteri.')
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
  saveDb(db)

  return {
    success: true,
    mustSetup: member.must_setup || !member.password_changed,
  }
}

export async function logoutFn() {
  const db = await loadDb()
  db.current_user_id = null
  saveDb(db)
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
  const recoveryPhrase = requiredString(data, 'recovery_phrase', 500)
  if (username.length < 3) throw new Error('Lo username deve contenere almeno 3 caratteri.')
  assertStrongPassword(password, 'La password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.')
  assertStrongRecoveryPhrase(recoveryPhrase)

  if (db.members.some((member) => member.id !== user.id && member.username.toLowerCase() === username)) {
    throw new Error('Questo username è già in uso.')
  }

  user.username = username
  user.password_hash = await digestPassword(password)
  user.recovery_phrase_hash = await digestPassword(normalizeRecoveryPhrase(recoveryPhrase))
  user.password_changed = true
  user.must_setup = false
  saveDb(db)
  return { success: true }
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
  saveDb(db)
  return { success: true }
}

export async function changeAdminRecoveryPhraseFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const admin = assertReadyAdmin(db)
  const currentPassword = requiredString(data, 'current_password', 256)
  const recoveryPhrase = requiredString(data, 'recovery_phrase', 500)

  if (!(await verifyPassword(currentPassword, admin.password_hash))) {
    throw new Error('La password attuale non e corretta')
  }

  assertStrongRecoveryPhrase(recoveryPhrase)
  admin.recovery_phrase_hash = await digestPassword(normalizeRecoveryPhrase(recoveryPhrase))
  saveDb(db)
  return { success: true }
}

export async function recoverPasswordFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  const username = requiredString(data, 'username', 80).toLowerCase()
  const recoveryPhrase = requiredString(data, 'recovery_phrase', 500)
  const newPassword = requiredString(data, 'new_password', 256)
  const member = db.members.find((candidate) => candidate.username.toLowerCase() === username)

  assertStrongPassword(newPassword, 'La nuova password deve contenere almeno 8 caratteri, una maiuscola, un numero e un simbolo.')

  if (!member || !member.recovery_phrase_hash || !(await verifyPassword(normalizeRecoveryPhrase(recoveryPhrase), member.recovery_phrase_hash))) {
    throw new Error('Username o frase di recupero non validi.')
  }

  if (await verifyPassword(newPassword, member.password_hash)) {
    throw new Error('La nuova password deve essere diversa da quella attuale')
  }

  member.password_hash = await digestPassword(newPassword)
  member.password_changed = true
  member.must_setup = false
  db.current_user_id = member.id
  saveDb(db)
  return { success: true }
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
    recovery_phrase_hash: null,
    joined_at: joinedAt.toISOString(),
    expiry_date: expiryDate.toISOString(),
    password_changed: false,
    must_setup: true,
    role: 'user',
  }

  db.members.push(member)
  saveDb(db)

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
  saveDb(db)
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
  saveDb(db)
  return { success: true }
}

export async function registerAttendanceFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const db = await loadDb()
  assertReadyAdmin(db)
  const code = requiredString(data, 'member_id', 120)
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
  saveDb(db)
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
  saveDb(db)
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
      password: member.password_hash,
      recovery_phrase_hash: member.recovery_phrase_hash,
    joined_at: member.joined_at,
    expiry_date: member.expiry_date,
    password_changed: member.password_changed,
    must_setup: member.must_setup,
    role: {
      id: `role-${member.id}`,
      role: member.role,
    },
  }))
  const backup = {
    application: 'gestore-pub',
    version: 1,
    exported_at: exportedAt,
    notes: 'Backup completo: contiene hash password, token QR, soci, ruoli e storico presenze. Conservare in modo privato.',
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
        ['id', 'role', 'first_name', 'last_name', 'member_number', 'username', 'joined_at', 'expiry_date', 'password_changed', 'must_setup', 'qr_token', 'recovery_phrase_set'],
        members.map((member) => [
          member.id,
          member.role.role,
          member.first_name,
          member.last_name,
          member.member_number ?? '',
          member.username,
          member.joined_at,
          member.expiry_date ?? '',
          member.password_changed,
          member.must_setup,
          member.qr_token ?? '',
          Boolean(member.recovery_phrase_hash),
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

export async function restoreBackupFn(args?: FnArgs) {
  const data = getData(args)
  assertRecord(data)
  const backupText = requiredString(data, 'backup', 20 * 1024 * 1024)
  const db = await loadDb()
  const user = assertReadyAdmin(db)

  let parsed: any
  try {
    parsed = JSON.parse(backupText)
  } catch {
    throw new Error('Il file selezionato non e un backup JSON valido')
  }

  if (parsed?.application !== 'gestore-pub' || parsed.version !== 1 || !Array.isArray(parsed.data?.members) || !Array.isArray(parsed.data?.attendances)) {
    throw new Error('Backup non compatibile con questa applicazione')
  }

  const restored: DesktopDb = {
    version: 1,
    current_user_id: null,
    members: parsed.data.members.map((member: any) => ({
      id: requiredString(member, 'id', 120),
      first_name: requiredString(member, 'first_name', 80),
      last_name: requiredString(member, 'last_name', 80),
      member_number: nullableString(member, 'member_number', 80),
      qr_token: nullableString(member, 'qr_token', 120),
      username: requiredString(member, 'username', 80).toLowerCase(),
      password_hash: requiredString(member, 'password', 500),
      recovery_phrase_hash: nullableString(member, 'recovery_phrase_hash', 500),
      joined_at: requiredString(member, 'joined_at', 80),
      expiry_date: nullableString(member, 'expiry_date', 80),
      password_changed: Boolean(member.password_changed),
      must_setup: Boolean(member.must_setup),
      role: member.role?.role === 'admin' ? 'admin' : 'user',
    })),
    attendances: parsed.data.attendances.map((attendance: any) => ({
      id: requiredString(attendance, 'id', 120),
      member_id: nullableString(attendance, 'member_id', 120),
      check_in_time: requiredString(attendance, 'check_in_time', 80),
      check_in_day: requiredString(attendance, 'check_in_day', 20),
      member_first_name: requiredString(attendance, 'member_first_name', 80),
      member_last_name: requiredString(attendance, 'member_last_name', 80),
      member_number: requiredString(attendance, 'member_number', 80),
      member_was_deleted: Boolean(attendance.member_was_deleted),
    })),
  }

  if (restored.members.filter((member) => member.role === 'admin').length !== 1) {
    throw new Error('Il backup deve contenere esattamente un account amministratore')
  }

  const currentAdminRestored = restored.members.some((member) => member.id === user.id && member.role === 'admin')
  restored.current_user_id = currentAdminRestored ? user.id : null
  saveDb(restored)

  return {
    success: true,
    keptSession: currentAdminRestored,
    restored: {
      members: restored.members.length,
      attendances: restored.attendances.length,
    },
  }
}
