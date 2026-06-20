type ExportMode = 'downloads' | 'folder'

type ExportPreference = {
  mode: ExportMode
  directoryName: string | null
}

export type SaveResult = {
  method: ExportMode
  directoryName: string | null
  directoryPath: string | null
  filePath: string | null
  canOpenDirectory: boolean
}

type DirectoryHandle = {
  name: string
  queryPermission?: (descriptor?: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode: 'readwrite' }) => Promise<PermissionState>
  getFileHandle: (name: string, options?: { create: boolean }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>
    __TAURI__?: {
      core?: {
        invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
      }
    }
  }
}

export const DOWNLOAD_SUCCESS_EVENT = 'the-club:download-success'
const EXPORT_PREF_KEY = 'the-club:export-preference'
const EXPORT_DB_NAME = 'the-club-export-settings'
const EXPORT_STORE_NAME = 'handles'
const EXPORT_DIRECTORY_HANDLE_KEY = 'directory'

function readPreference(): ExportPreference {
  if (typeof window === 'undefined') {
    return { mode: 'downloads', directoryName: null }
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(EXPORT_PREF_KEY) ?? '') as Partial<ExportPreference>
    if (parsed.mode === 'folder' || parsed.mode === 'downloads') {
      return {
        mode: parsed.mode,
        directoryName: typeof parsed.directoryName === 'string' ? parsed.directoryName : null,
      }
    }
  } catch {
    // Ignore invalid local preferences and fall back to the browser default.
  }

  return { mode: 'downloads', directoryName: null }
}

function writePreference(preference: ExportPreference) {
  localStorage.setItem(EXPORT_PREF_KEY, JSON.stringify(preference))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EXPORT_DB_NAME, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(EXPORT_STORE_NAME)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getStoredDirectoryHandle(): Promise<DirectoryHandle | null> {
  if (!('indexedDB' in window)) return null

  const db = await openDb()
  return await new Promise<DirectoryHandle | null>((resolve, reject) => {
    const request = db
      .transaction(EXPORT_STORE_NAME, 'readonly')
      .objectStore(EXPORT_STORE_NAME)
      .get(EXPORT_DIRECTORY_HANDLE_KEY)

    request.onsuccess = () => resolve((request.result as DirectoryHandle | undefined) ?? null)
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

async function storeDirectoryHandle(handle: DirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(EXPORT_STORE_NAME, 'readwrite')
      .objectStore(EXPORT_STORE_NAME)
      .put(handle, EXPORT_DIRECTORY_HANDLE_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

async function deleteDirectoryHandle() {
  if (!('indexedDB' in window)) return

  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction(EXPORT_STORE_NAME, 'readwrite')
      .objectStore(EXPORT_STORE_NAME)
      .delete(EXPORT_DIRECTORY_HANDLE_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  }).finally(() => db.close())
}

async function ensureWritePermission(handle: DirectoryHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return true

  const current = await handle.queryPermission({ mode: 'readwrite' })
  if (current === 'granted') return true

  const next = await handle.requestPermission({ mode: 'readwrite' })
  return next === 'granted'
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string) {
  const sanitized = filename
    .replace(/[\/\\:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[. ]+|[. ]+$/g, '')

  return sanitized || 'export'
}

function getTauriInvoke() {
  if (typeof window === 'undefined') return null
  return window.__TAURI__?.core?.invoke ?? null
}

function formatDirectoryName(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.split('/').pop() || path
}

async function saveBlobWithTauri(filename: string, blob: Blob): Promise<SaveResult | null> {
  const invoke = getTauriInvoke()
  if (!invoke) return null

  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
  const [filePath, directoryPath] = await invoke<[string, string]>('save_export_file', {
    filename,
    bytes,
  })

  return {
    method: 'downloads',
    directoryName: formatDirectoryName(directoryPath),
    directoryPath,
    filePath,
    canOpenDirectory: true,
  }
}

function announceDownloadSuccess(filename: string, result: SaveResult) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DOWNLOAD_SUCCESS_EVENT, {
    detail: {
      filename,
      ...result,
    },
  }))
}

export function getExportPreference(): ExportPreference & { canChooseDirectory: boolean } {
  if (typeof window === 'undefined') {
    return {
      mode: 'downloads',
      directoryName: null,
      canChooseDirectory: false,
    }
  }

  return {
    ...readPreference(),
    canChooseDirectory: Boolean(window.showDirectoryPicker && 'indexedDB' in window),
  }
}

export async function chooseExportDirectory(): Promise<ExportPreference & { canChooseDirectory: boolean }> {
  if (typeof window === 'undefined') {
    return getExportPreference()
  }

  if (!window.showDirectoryPicker || !('indexedDB' in window)) {
    writePreference({ mode: 'downloads', directoryName: null })
    return getExportPreference()
  }

  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  if (!(await ensureWritePermission(handle))) {
    throw new Error('Permesso di scrittura negato per la cartella selezionata.')
  }

  await storeDirectoryHandle(handle)
  writePreference({ mode: 'folder', directoryName: handle.name })
  await navigator.storage?.persist?.()
  return getExportPreference()
}

export async function resetExportDirectory(): Promise<ExportPreference & { canChooseDirectory: boolean }> {
  if (typeof window === 'undefined') {
    return getExportPreference()
  }

  await deleteDirectoryHandle()
  writePreference({ mode: 'downloads', directoryName: null })
  return getExportPreference()
}

export async function saveBlobToPreferredDestination(filename: string, blob: Blob): Promise<SaveResult> {
  if (typeof window === 'undefined') {
    return { method: 'downloads', directoryName: null, directoryPath: null, filePath: null, canOpenDirectory: false }
  }

  const safeFilename = sanitizeDownloadFilename(filename)
  const preference = readPreference()

  if (preference.mode === 'folder') {
    const handle = await getStoredDirectoryHandle()
    if (handle && await ensureWritePermission(handle)) {
      const fileHandle = await handle.getFileHandle(safeFilename, { create: true })
      const writable = await fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      const result = {
        method: 'folder',
        directoryName: handle.name,
        directoryPath: null,
        filePath: null,
        canOpenDirectory: false,
      } satisfies SaveResult
      announceDownloadSuccess(safeFilename, result)
      return result
    }
  }

  const tauriResult = await saveBlobWithTauri(safeFilename, blob)
  if (tauriResult) {
    announceDownloadSuccess(safeFilename, tauriResult)
    return tauriResult
  }

  downloadBlob(safeFilename, blob)
  const result = {
    method: 'downloads',
    directoryName: null,
    directoryPath: null,
    filePath: null,
    canOpenDirectory: false,
  } satisfies SaveResult
  announceDownloadSuccess(safeFilename, result)
  return result
}

export async function openSavedFileLocation(result: Pick<SaveResult, 'directoryPath' | 'filePath'>) {
  const invoke = getTauriInvoke()
  const targetPath = result.directoryPath || result.filePath

  if (!invoke || !targetPath) {
    return false
  }

  await invoke('open_export_directory', { path: targetPath })
  return true
}

export async function saveTextFile(filename: string, content: string, type: string) {
  return await saveBlobToPreferredDestination(filename, new Blob([content], { type }))
}

export async function savePdfDocument(doc: { output: (type: 'blob') => Blob }, filename: string) {
  return await saveBlobToPreferredDestination(filename, doc.output('blob'))
}
