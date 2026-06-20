// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllMembersFn, getCurrentUserFn, resetDesktopDatabase, setupValidator, exportBackupFn, restoreBackupFn } from './desktop-api'

const DB_KEY = 'the-club:desktop-db'
const LEGACY_DB_KEY = 'gestore-pub:desktop-db'
type TestTauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

describe('desktop first launch bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
    delete (window as typeof window & { __TAURI__?: unknown }).__TAURI__
  })

  it('creates only the admin profile and opens the setup flow on first launch', async () => {
    const user = await getCurrentUserFn()

    expect(user).toMatchObject({
      username: 'admin',
      role: 'admin',
      must_setup: true,
      password_changed: false,
    })

    await setupValidator({
      data: {
        username: 'admin',
        password: 'NuovaPass1!',
        recovery_question: 'Nome della tua prima scuola?',
        recovery_answer: 'verdi',
      },
    })

    expect(await getAllMembersFn()).toEqual([])
  })

  it('migrates the legacy localStorage database to the Tauri app data file', async () => {
    let storedFile: string | null = null
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'read_desktop_db') return storedFile
      if (command === 'write_desktop_db') {
        storedFile = String(args?.contents ?? '')
        return null
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    ;(window as typeof window & {
      __TAURI__?: { core?: { invoke?: TestTauriInvoke } }
    }).__TAURI__ = { core: { invoke: invoke as unknown as TestTauriInvoke } }

    localStorage.setItem(LEGACY_DB_KEY, JSON.stringify({
      version: 1,
      current_user_id: 'admin-id',
      members: [{
        id: 'admin-id',
        first_name: 'Admin',
        last_name: 'Club',
        member_number: null,
        qr_token: null,
        username: 'admin',
        password_hash: 'local$salt$c2FsdDpwYXNz',
        recovery_question: null,
        recovery_phrase_hash: null,
        joined_at: new Date().toISOString(),
        expiry_date: null,
        password_changed: false,
        must_setup: true,
        role: 'admin',
      }],
      attendances: [],
    }))

    const user = await getCurrentUserFn()

    expect(user?.username).toBe('admin')
    expect(storedFile).toContain('"username":"admin"')
    expect(localStorage.getItem(DB_KEY)).toBeNull()
    expect(localStorage.getItem(LEGACY_DB_KEY)).toBeNull()
    expect(invoke).toHaveBeenCalledWith('read_desktop_db')
    expect(invoke).toHaveBeenCalledWith('write_desktop_db', expect.objectContaining({
      contents: expect.any(String),
    }))
  })

  it('creates the Tauri app data database automatically on first launch', async () => {
    let storedFile: string | null = null
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'read_desktop_db') return storedFile
      if (command === 'write_desktop_db') {
        storedFile = String(args?.contents ?? '')
        return null
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    ;(window as typeof window & {
      __TAURI__?: { core?: { invoke?: TestTauriInvoke } }
    }).__TAURI__ = { core: { invoke: invoke as unknown as TestTauriInvoke } }

    const user = await getCurrentUserFn()

    expect(user).toMatchObject({
      username: 'admin',
      role: 'admin',
      must_setup: true,
    })
    expect(storedFile).toContain('"members"')
    expect(localStorage.getItem(DB_KEY)).toBeNull()
  })

  it('resets the Tauri database file without clearing unrelated local preferences', async () => {
    const invoke = vi.fn(async () => null)
    ;(window as typeof window & {
      __TAURI__?: { core?: { invoke?: TestTauriInvoke } }
    }).__TAURI__ = { core: { invoke: invoke as unknown as TestTauriInvoke } }

    localStorage.setItem(DB_KEY, '{"version":1}')
    localStorage.setItem('theme', 'dark')

    await resetDesktopDatabase()

    expect(invoke).toHaveBeenCalledWith('reset_desktop_db')
    expect(localStorage.getItem(DB_KEY)).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})

describe('desktop backup and restore security and QA', () => {
  beforeEach(async () => {
    localStorage.clear()
    delete (window as any).__TAURI__
    // Setup initial DB and admin
    await getCurrentUserFn()
    await setupValidator({
      data: {
        username: 'admin',
        password: 'NuovaPass1!',
        recovery_question: 'Nome della tua prima scuola?',
        recovery_answer: 'verdi',
      },
    })
  })

  it('standard backup does not export credentials', async () => {
    const stdBackupResult = await exportBackupFn()
    expect(stdBackupResult.backup.data.members[0]).not.toHaveProperty('password')
    expect(stdBackupResult.backup.data.members[0]).not.toHaveProperty('recovery_phrase_hash')
    expect(stdBackupResult.backup.data.members[0].has_recovery_answer).toBe(true)
  })

  it('restore rejects backups with duplicate usernames', async () => {
    const stdBackup = await exportBackupFn()
    const backupObj = JSON.parse(JSON.stringify(stdBackup.backup))
    // Duplicate the admin member with a different ID but same username
    backupObj.data.members.push({
      ...backupObj.data.members[0],
      id: 'duplicate-id',
    })

    await expect(restoreBackupFn({ data: { backup: JSON.stringify(backupObj) } }))
      .rejects.toThrow('Backup non valido: valore duplicato in username soci')
  })

  it('restore rejects backups with invalid member dates', async () => {
    const stdBackup = await exportBackupFn()
    const backupObj = JSON.parse(JSON.stringify(stdBackup.backup))
    backupObj.data.members[0].joined_at = 'not-a-date'

    await expect(restoreBackupFn({ data: { backup: JSON.stringify(backupObj) } }))
      .rejects.toThrow('Data non valida')
  })

  it('restore rejects backups with too many members or oversized payloads', async () => {
    const stdBackup = await exportBackupFn()
    const tooManyMembersBackup = JSON.parse(JSON.stringify(stdBackup.backup))
    tooManyMembersBackup.data.members = Array.from({ length: 10001 }, (_, index) => ({
      ...stdBackup.backup.data.members[0],
      id: `member-${index}`,
      username: `member-${index}`,
      role: {
        ...stdBackup.backup.data.members[0].role,
        id: `role-${index}`,
        role: index === 0 ? 'admin' : 'user',
      },
      member_number: index === 0 ? null : `CARD-${index}`,
      qr_token: index === 0 ? null : `qr-${index}`,
    }))

    await expect(restoreBackupFn({ data: { backup: JSON.stringify(tooManyMembersBackup) } }))
      .rejects.toThrow('Backup non valido: numero soci fuori limite')

    await expect(restoreBackupFn({ data: { backup: `{"x":"${'a'.repeat(20 * 1024 * 1024)}"}` } }))
      .rejects.toThrow('Backup troppo grande')
  })

  it('restore handles standard backups by generating temporary passwords', async () => {
    const stdBackup = await exportBackupFn()
    const backupText = JSON.stringify(stdBackup.backup)

    const result = await restoreBackupFn({ data: { backup: backupText } })
    expect(result.success).toBe(true)

    // Check that admin was restored and kept session
    const currentUser = await getCurrentUserFn()
    expect(currentUser?.username).toBe('admin')
    expect(currentUser?.must_setup).toBe(true)
    expect(currentUser?.password_changed).toBe(false)
  })

  it('restore accepts backups exported before the rename', async () => {
    const stdBackup = await exportBackupFn()
    const backupObj = JSON.parse(JSON.stringify(stdBackup.backup))
    backupObj.application = 'gestore-pub'

    const result = await restoreBackupFn({ data: { backup: JSON.stringify(backupObj) } })

    expect(result.success).toBe(true)
  })
})
