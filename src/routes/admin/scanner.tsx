import { createFileRoute, Link, redirect, useLoaderData } from '@tanstack/react-router'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { getCheckInMembersFn, getTodayAttendanceFn, registerAttendanceFn } from '../../lib/api'
import { Html5Qrcode, Html5QrcodeSupportedFormats, type QrcodeSuccessCallback, type QrcodeErrorCallback, type CameraDevice } from 'html5-qrcode'
import { QrCode, ArrowLeft, ShieldAlert, CheckCircle2, AlertTriangle, Play, Pause, History, Keyboard, Search, UserCheck, Users, Clock, Camera } from 'lucide-react'

export const Route = createFileRoute('/admin/scanner')({
  loader: async () => {
    try {
      const members = await getCheckInMembersFn()
      const todayLogs = await getTodayAttendanceFn()
      return { members, todayLogs }
    } catch (e: any) {
      throw new Error(e?.message || 'Impossibile caricare i dati per la registrazione presenze.')
    }
  },
  component: ScannerPage,
  beforeLoad: async ({ context }) => {
    if (!context.user || context.user.role !== 'admin') {
      throw redirect({ to: '/', replace: true })
    }
  },
})

interface ScanLog {
  id: string
  name: string
  memberNumber: string
  status: 'success' | 'warning' | 'error'
  message: string
  time: string
}

const SCANNER_ELEMENT_ID = 'qr-reader-container'

function ScannerPage() {
  const { members, todayLogs } = useLoaderData({ from: '/admin/scanner' })
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(true)
  const [scannerLoading, setScannerLoading] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [pendingCodes, setPendingCodes] = useState<Set<string>>(() => new Set())
  const [todayCount, setTodayCount] = useState(todayLogs.length)
  const [checkedMemberIds, setCheckedMemberIds] = useState(
    () => new Set(todayLogs.map((log) => log.member.id).filter(Boolean))
  )
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  
  // Last scan result feedback state
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error'
    message: string
    name?: string
    memberNumber?: string
  }>({ status: 'idle', message: 'In attesa di scansione...' })

  // Session scan log
  const [logs, setLogs] = useState<ScanLog[]>([])
 
  // Debouncing refs to avoid double scanning with synchronous execution safety
  const lastScanTimeRef = useRef<number>(0)
  const lastScanValueRef = useRef<string>('')
 
  // Scanner instance ref
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const activeRef = useRef(active)
  activeRef.current = active

  useEffect(() => {
    setMounted(true)
  }, [])

  const filteredMembers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase()
    if (!term) return members.slice(0, 25)

    return members.filter((member) => {
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
      return (
        fullName.includes(term) ||
        member.member_number.toLowerCase().includes(term)
      )
    }).slice(0, 50)
  }, [memberSearch, members])

  const getMemberStatus = (expiryDate: string) => {
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        expired: true,
        text: 'Scaduta',
        className: 'border-red-500/20 bg-red-500/10 text-red-500',
      }
    }

    if (diffDays <= 30) {
      return {
        expired: false,
        text: diffDays === 0 ? 'Scade oggi' : `${diffDays} gg`,
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
      }
    }

    return {
      expired: false,
      text: 'Valida',
      className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
    }
  }
 
  const normalizeCodeValue = (rawValue: string) => {
    const value = rawValue.trim()
    if (!value) return ''
 
    try {
      const url = new URL(value)
      return (
        url.searchParams.get('member_id') ||
        url.searchParams.get('memberId') ||
        url.pathname.split('/').filter(Boolean).at(-1) ||
        value
      ).trim()
    } catch {
      return value
    }
  }

  const generateLocalId = () => crypto.randomUUID()
 
  const processCode = async (rawValue: string, source: 'scanner' | 'manual' = 'manual') => {
    const codeValue = normalizeCodeValue(rawValue)
    if (!codeValue) return

    if (pendingCodes.has(codeValue)) return
 
    const now = Date.now()
 
    if (source === 'scanner') {
      if (scannerLoading) return

      // Debounce only camera scans. Manual clicks must remain fast.
      if (
        now - lastScanTimeRef.current < 1200 || 
        (codeValue === lastScanValueRef.current && now - lastScanTimeRef.current < 4500)
      ) {
        return
      }

      lastScanTimeRef.current = now
      lastScanValueRef.current = codeValue
      setScannerLoading(true)
    }
 
    setPendingCodes((prev) => new Set(prev).add(codeValue))
    setScanResult({ status: 'idle', message: 'Elaborazione del codice QR...' })
 
    try {
      const res = await registerAttendanceFn({
        data: { identifier: codeValue },
      })
 
      const timeString = new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      if (res.success) {
        const memberName = `${res.member.first_name} ${res.member.last_name}`
        const memberNum = res.member.member_number ?? 'N/D'
 
        if (res.alreadyCheckedIn) {
          setScanResult({
            status: 'warning',
            message: `${memberName} ha già registrato la presenza oggi.`,
            name: memberName,
            memberNumber: memberNum,
          })
          
          setLogs((prev) => [
            {
              id: generateLocalId(),
              name: memberName,
              memberNumber: memberNum,
              status: 'warning',
              message: 'Già registrato oggi',
              time: timeString,
            },
            ...prev.slice(0, 9), // limit to last 10
          ])
          if (res.member.id) {
            setCheckedMemberIds((prev) => new Set(prev).add(res.member.id))
          }
        } else {
          setScanResult({
            status: 'success',
            message: `Presenza registrata con successo.`,
            name: memberName,
            memberNumber: memberNum,
          })
 
          setLogs((prev) => [
            {
              id: generateLocalId(),
              name: memberName,
              memberNumber: memberNum,
              status: 'success',
              message: 'Presenza registrata',
              time: timeString,
            },
            ...prev.slice(0, 9),
          ])
          if (res.member.id) {
            setCheckedMemberIds((prev) => new Set(prev).add(res.member.id))
          }
          setTodayCount((count) => count + 1)
        }
      }
    } catch (err: any) {
      const timeString = new Date().toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      const errMsg = err?.message || 'QR Code non valido o tessera non trovata.'
 
      setScanResult({
        status: 'error',
        message: errMsg,
      })

      setLogs((prev) => [
        {
          id: generateLocalId(),
          name: 'Sconosciuto',
          memberNumber: 'N/D',
          status: 'error',
          message: errMsg,
          time: timeString,
        },
        ...prev.slice(0, 9),
      ])
    } finally {
      setPendingCodes((prev) => {
        const next = new Set(prev)
        next.delete(codeValue)
        return next
      })
      if (source === 'scanner') {
        setScannerLoading(false)
      }
    }
  }

  // Stable callback refs for the scanner
  const processCodeRef = useRef(processCode)
  processCodeRef.current = processCode

  const handleScanSuccess: QrcodeSuccessCallback = useCallback((decodedText: string) => {
    if (!activeRef.current) return
    setCameraError(null)
    void processCodeRef.current(decodedText, 'scanner')
  }, [])

  const handleScanError: QrcodeErrorCallback = useCallback(() => {
    // Per-frame decode failures are normal (no QR in view) — ignore them.
    // Only surface real camera errors via the start() promise rejection.
  }, [])

  // Start / stop the camera scanner based on `active` state and selected camera
  useEffect(() => {
    if (!mounted || !active) return

    let cancelled = false
    setCameraError(null)

    const startScanner = async () => {
      try {
        // Always create a fresh scanner instance to avoid state manager
        // transition errors ("cannot transition to a new state, already under transition")
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop()
            }
            scannerRef.current.clear()
          } catch {
            // ignore cleanup errors from previous instance
          }
          scannerRef.current = null
        }

        // Wait one tick for DOM to be ready
        await new Promise((resolve) => setTimeout(resolve, 50))
        if (cancelled) return

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        })
        scannerRef.current = scanner

        // Determine camera config
        let cameraConfig: string | MediaTrackConstraints

        if (selectedCameraId) {
          cameraConfig = selectedCameraId
        } else {
          // Auto-detect: prefer back/environment camera
          try {
            const detectedCameras = await Html5Qrcode.getCameras()
            if (cancelled) return
            setCameras(detectedCameras || [])

            if (detectedCameras && detectedCameras.length > 0) {
              const backCamera = detectedCameras.find((cam) =>
                /back|rear|environment|posteriore/i.test(cam.label)
              )
              const chosenId = backCamera?.id || detectedCameras[detectedCameras.length - 1].id
              setSelectedCameraId(chosenId)
              cameraConfig = chosenId
            } else {
              cameraConfig = { facingMode: 'environment' }
            }
          } catch {
            cameraConfig = { facingMode: 'environment' }
          }
        }

        if (cancelled) return

        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          handleScanSuccess,
          handleScanError
        )

        if (cancelled) {
          await scanner.stop().catch(() => {})
          scanner.clear()
          scannerRef.current = null
        }
      } catch (err: any) {
        if (cancelled) return
        console.error('QR Scanner start error:', err)
        const errStr = String(err?.message || err || '')
        let message = 'Errore durante l’avvio dello scanner.'

        if (/permission|denied|notallowed/i.test(errStr)) {
          message = 'Permesso fotocamera negato. Consenti l’accesso alla fotocamera dalle impostazioni di sistema.'
        } else if (/notfound|no camera|no device|notfounderror/i.test(errStr)) {
          message = 'Nessuna fotocamera trovata sul dispositivo.'
        } else if (/in use|already in use|trackstart/i.test(errStr)) {
          message = 'La fotocamera è già in uso da un’altra applicazione.'
        } else if (/notreadable|notreadableerror/i.test(errStr)) {
          message = 'Impossibile accedere alla fotocamera. Potrebbe essere in uso da un’altra app.'
        } else if (/overconstrained|constraint/i.test(errStr)) {
          message = 'La fotocamera richiesta non è disponibile. Prova a cambiare dispositivo.'
        } else if (/notsupported|notsupportederror/i.test(errStr)) {
          message = 'Scanner non supportato da questo browser.'
        } else if (errStr) {
          message = errStr
        }

        setCameraError(message)
      }
    }

    void startScanner()

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      if (scanner) {
        if (scanner.isScanning) {
          scanner
            .stop()
            .then(() => {
              try { scanner.clear() } catch { /* ignore */ }
              scannerRef.current = null
            })
            .catch(() => {
              try { scanner.clear() } catch { /* ignore */ }
              scannerRef.current = null
            })
        } else {
          try { scanner.clear() } catch { /* ignore */ }
          scannerRef.current = null
        }
      }
    }
  }, [mounted, active, selectedCameraId, handleScanSuccess, handleScanError])

  // Refresh camera list on mount
  useEffect(() => {
    if (!mounted) return
    Html5Qrcode.getCameras()
      .then((detected) => {
        if (detected && detected.length > 0) {
          setCameras(detected)
        }
      })
      .catch(() => {
        // Ignore — will be handled by the scanner start effect
      })
  }, [mounted])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await processCode(manualCode, 'manual')
    setManualCode('')
  }

  if (!mounted) {
    return (
      <main className="page-wrap px-4 py-8 sm:py-12 flex justify-center items-center">
        <p className="text-sm font-semibold text-[var(--sea-ink-soft)]">Caricamento scanner fotocamera...</p>
      </main>
    )
  }

  return (
    <main className="page-wrap pb-10 pt-4 sm:px-4 sm:pb-12 sm:pt-8">
      <div className="mx-auto max-w-4xl">
        {/* Back Link */}
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sea-ink-soft)] no-underline transition hover:text-[var(--sea-ink)] sm:mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Torna al Pannello Membri
        </Link>

        <section className="mb-5 rounded-3xl border border-rose-500/15 bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(234,179,8,0.13),rgba(20,111,118,0.10))] p-5 text-center sm:mb-6 sm:p-8">
          <h1 className="display-title text-[1.9rem] font-black leading-tight tracking-tight text-[var(--sea-ink)] sm:text-5xl">
            Registra Presenze
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--sea-ink-soft)]">
            Usa lo scanner QR oppure cerca il socio per nome o numero tessera: tutto il check-in passa da qui.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/60 bg-white/45 p-3">
              <Users className="mx-auto h-5 w-5 text-rose-500" />
              <span className="mt-1 block text-xl font-black text-[var(--sea-ink)]">{members.length}</span>
              <span className="block text-[10px] font-bold uppercase text-[var(--sea-ink-soft)]">Soci</span>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/45 p-3">
              <UserCheck className="mx-auto h-5 w-5 text-emerald-500" />
              <span className="mt-1 block text-xl font-black text-[var(--sea-ink)]">{todayCount}</span>
              <span className="block text-[10px] font-bold uppercase text-[var(--sea-ink-soft)]">Ingressi oggi</span>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/45 p-3">
              <Clock className="mx-auto h-5 w-5 text-amber-500" />
              <span className="mt-1 block text-xl font-black text-[var(--sea-ink)]">{logs.length}</span>
              <span className="block text-[10px] font-bold uppercase text-[var(--sea-ink-soft)]">Sessione</span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Live Scanner Viewport Column */}
          <section className="island-shell flex flex-col items-center justify-between rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6">
            <div className="mobile-safe-row mb-3 w-full justify-between sm:mb-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-[var(--sea-ink-soft)] sm:text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
                Fotocamera {active ? 'Attiva' : 'Pausa'}
              </span>

              <button
                onClick={() => setActive(!active)}
                className={`mobile-action inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  active 
                    ? 'border-stone-500/20 bg-stone-500/10 text-[var(--sea-ink)] hover:bg-stone-500/20' 
                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                }`}
              >
                {active ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pausa
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Attiva
                  </>
                )}
              </button>
            </div>

            {/* Camera selector */}
            {cameras.length > 1 && (
              <div className="mb-3 flex w-full items-center gap-2 sm:mb-4">
                <Camera className="h-4 w-4 shrink-0 text-[var(--sea-ink-soft)]" />
                <select
                  value={selectedCameraId ?? ''}
                  onChange={(e) => setSelectedCameraId(e.target.value || null)}
                  className="block min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white/50 px-3 py-2 text-xs font-semibold text-[var(--sea-ink)] focus:border-rose-500/50 focus:outline-none"
                >
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Fotocamera ${cam.id.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Scope Scanner Box */}
            <div className="scanner-frame relative flex aspect-square w-full items-center justify-center overflow-hidden border-2 border-[var(--line)] bg-stone-950 shadow-inner sm:max-w-sm sm:rounded-2xl">
              {active ? (
                <div className="w-full h-full relative">
                  {/* Scanner overlay corners */}
                  <div className="scanner-target pointer-events-none absolute z-10 flex items-center justify-center rounded-xl border-2 border-white/20">
                    <div className="scanner-target-inner animate-pulse rounded-lg border-2 border-dashed border-rose-500/50" />
                  </div>
                  
                  {/* html5-qrcode mounts the video element inside this div */}
                  <div id={SCANNER_ELEMENT_ID} className="w-full h-full" style={{ borderRadius: '0.75rem', overflow: 'hidden' }} />
                </div>
              ) : (
                <div className="text-center p-6 text-stone-500">
                  <QrCode className="w-16 h-16 mx-auto opacity-30 mb-2" />
                  <p className="text-xs font-semibold">Fotocamera in Pausa.</p>
                  <p className="text-[10px] opacity-75 mt-1">Clicca su Attiva per avviare il feed.</p>
                </div>
              )}
            </div>

            {/* Live feedback status box */}
            <div className="mt-4 w-full sm:mt-6">
              {cameraError && (
                <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-semibold text-amber-600">
                  {cameraError}
                </div>
              )}

              {scanResult.status === 'success' && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-500 sm:items-center sm:gap-3.5 sm:p-5">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider block">Check-In Eseguito</span>
                    <span className="text-sm font-bold text-[var(--sea-ink)] mt-0.5 block">{scanResult.name}</span>
                    <span className="text-[10px] text-[var(--sea-ink-soft)] font-mono block">Tessera: {scanResult.memberNumber}</span>
                  </div>
                </div>
              )}

              {scanResult.status === 'warning' && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-600 sm:items-center sm:gap-3.5 sm:p-5">
                  <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider block">Già Registrato</span>
                    <span className="text-sm font-bold text-[var(--sea-ink)] mt-0.5 block">{scanResult.name}</span>
                    <span className="text-[10px] text-[var(--sea-ink-soft)] font-mono block">Tessera: {scanResult.memberNumber}</span>
                  </div>
                </div>
              )}

              {scanResult.status === 'error' && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-500 sm:items-center sm:gap-3.5 sm:p-5">
                  <ShieldAlert className="h-6 w-6 shrink-0 text-red-500 sm:h-8 sm:w-8" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider block">Errore Scansione</span>
                    <p className="text-xs font-semibold text-[var(--sea-ink)] mt-1">{scanResult.message}</p>
                  </div>
                </div>
              )}

              {scanResult.status === 'idle' && (
                <div className="rounded-2xl border border-[var(--line)] bg-white/20 p-5 flex items-center justify-center text-center text-xs text-[var(--sea-ink-soft)] font-medium">
                  {scanResult.message}
                </div>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                  <Keyboard className="h-4 w-4" />
                </span>
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Valore QR tessera"
                  className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 pl-9 pr-3 text-xs text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim() || pendingCodes.has(normalizeCodeValue(manualCode))}
                className="mobile-action cursor-pointer rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-rose-600 disabled:pointer-events-none disabled:opacity-50"
              >
                {pendingCodes.has(normalizeCodeValue(manualCode)) ? 'Registro...' : 'Registra'}
              </button>
            </form>
          </section>

          <div className="flex flex-col gap-4 sm:gap-6">
          <section className="island-shell flex flex-col rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--line)] pb-3 sm:mb-5 sm:pb-4">
              <Search className="w-5 h-5 text-rose-500" />
              <h2 className="display-title m-0 text-lg font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-xl">
                Cerca Socio
              </h2>
            </div>

            <div className="relative mb-3">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--sea-ink-soft)]">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Nome, cognome o numero tessera..."
                className="block w-full rounded-xl border border-[var(--line)] bg-white/40 py-2.5 pl-9 pr-3 text-xs text-[var(--sea-ink)] placeholder-stone-400 focus:border-rose-500/50 focus:bg-white/80 focus:outline-none"
              />
            </div>

            <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1">
              {filteredMembers.length > 0 ? filteredMembers.map((member) => {
                const memberName = `${member.first_name} ${member.last_name}`
                const status = getMemberStatus(member.expiry_date)
                const alreadyChecked = checkedMemberIds.has(member.id)
                const isPending = pendingCodes.has(member.id)

                return (
                  <div key={member.id} className="rounded-xl border border-[var(--line)] bg-white/25 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-[var(--sea-ink)]">{memberName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-stone-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--sea-ink-soft)]">
                            {member.member_number}
                          </span>
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                            {alreadyChecked ? 'Già presente' : status.text}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => processCode(member.id)}
                        disabled={isPending || status.expired || alreadyChecked}
                        className="mobile-action inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <UserCheck className="h-4 w-4" />
                        {isPending ? 'Registro...' : 'Registra'}
                      </button>
                    </div>
                  </div>
                )
              }) : (
                <div className="py-10 text-center text-xs font-medium text-[var(--sea-ink-soft)]">
                  Nessun socio trovato.
                </div>
              )}
            </div>
          </section>

          {/* Session Scan Log Column */}
          <section className="island-shell flex flex-col rounded-2xl p-3.5 sm:rounded-[2rem] sm:p-6">
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--line)] pb-3 sm:mb-6 sm:pb-4">
              <History className="w-5 h-5 text-rose-500" />
              <h2 className="display-title m-0 text-lg font-bold leading-tight tracking-tight text-[var(--sea-ink)] sm:text-xl">
                Scansioni Recenti Sessione
              </h2>
            </div>

            <div className="max-h-none flex-1 space-y-3 overflow-y-auto pr-0 sm:max-h-[55vh] sm:pr-1">
              {logs.length > 0 ? (
                logs.map((log) => {
                  let logStyles = 'border-[var(--line)] bg-white/20'
                  let logBadge = 'border-stone-500/20 bg-stone-500/10 text-[var(--sea-ink-soft)]'
                  
                  if (log.status === 'success') {
                    logBadge = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                  } else if (log.status === 'warning') {
                    logBadge = 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                  } else if (log.status === 'error') {
                    logBadge = 'border-red-500/20 bg-red-500/10 text-red-500'
                  }

                  return (
                    <div
                      key={log.id}
                      className={`flex flex-col gap-2 rounded-xl border p-3 transition hover:bg-white/40 sm:flex-row sm:items-center sm:justify-between ${logStyles}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--sea-ink)]">
                          {log.name}
                        </span>
                        <span className="text-[10px] text-[var(--sea-ink-soft)] mt-0.5 font-semibold">
                          {log.message}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-end">
                        <span className="text-[9px] text-[var(--sea-ink-soft)] font-mono">
                          {log.time}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border font-mono ${logBadge}`}>
                          Tessera: {log.memberNumber}
                        </span>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-20 text-center text-xs text-[var(--sea-ink-soft)] font-medium">
                  Nessuna scansione registrata in questa sessione.
                </div>
              )}
            </div>
          </section>
          </div>
        </div>
      </div>
    </main>
  )
}
