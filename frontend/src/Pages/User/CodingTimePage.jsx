import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import WorkspaceHeader from '../../Components/Common/WorkspaceHeader'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const LANGUAGES = ['JavaScript', 'Python', 'Java', 'C', 'C++', 'C#', 'HTML/CSS', 'SQL', 'TypeScript', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Other']
const LANGUAGE_COLORS = ['#a78bfa', '#ffb86b', '#fb923c', '#4ade80', '#c084fc', '#f5f0e6']
const COLOR_BY_LANGUAGE = Object.fromEntries(LANGUAGES.map((language, index) => [language, LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]]))
const INITIAL_POMODORO = { preset: 'work', phase: 'work', workMinutes: 25, breakMinutes: 5, total: 25 * 60, remaining: 25 * 60, running: false }
const cardClass = 'rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.6)] sm:p-5'
const buttonClass = 'inline-flex items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.055] px-3 py-2 text-[12.5px] font-semibold text-slate-200 transition hover:border-cyan-400/45 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-55'
const primaryButtonClass = 'inline-flex items-center justify-center rounded-lg border border-cyan-400/45 bg-cyan-400/16 px-3 py-2 text-[12.5px] font-semibold text-cyan-200 transition hover:bg-cyan-400/24 disabled:cursor-not-allowed disabled:opacity-55'

const getResponseData = (response, fallbackMessage) => {
  if (!response.data?.success) throw new Error(response.data?.message || fallbackMessage)
  return response.data.data || {}
}

const codingRequests = {
  list: async () => (await getResponseData(await api.get('/api/coding-sessions'), 'Unable to load coding sessions')).sessions || [],
  create: async (payload) => (await getResponseData(await api.post('/api/coding-sessions', payload), 'Unable to log coding session')).session,
  remove: async (sessionId) => getResponseData(await api.delete(`/api/coding-sessions/${sessionId}`), 'Unable to delete coding session'),
}

const semesterRequests = {
  list: async () => (await getResponseData(await api.get('/api/semesters'), 'Unable to load subjects')).semesters || [],
}

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback
const localDateKey = (date = new Date()) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const formatMinutes = (minutes) => {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = minutes / 60
  return `${hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10}h`
}
const formatClock = (seconds) => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
const formatPomodoroClock = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
const formatSessionDate = (value) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
const sameLocalDay = (first, second = new Date()) => new Date(first).toDateString() === new Date(second).toDateString()
const sortSessions = (sessions) => [...sessions].sort((first, second) => new Date(second.date) - new Date(first.date) || new Date(second.createdAt) - new Date(first.createdAt))

function LoadingState() {
  return <div className={`${cardClass} flex min-h-52 items-center justify-center text-sm text-slate-400`}>Loading your coding sessions…</div>
}

function ErrorNotice({ message, onDismiss }) {
  if (!message) return null
  return <div role="alert" className="mb-[14px] flex items-center justify-between gap-3 rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"><span>{message}</span><button type="button" onClick={onDismiss} className="font-semibold hover:text-white">Dismiss</button></div>
}

export default function CodingTimePage() {
  const [sessions, setSessions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [timerLanguage, setTimerLanguage] = useState('JavaScript')
  const [freeTimer, setFreeTimer] = useState({ running: false, startedAt: null, elapsed: 0 })
  const [pomoLanguage, setPomoLanguage] = useState('JavaScript')
  const [pomodoro, setPomodoro] = useState(INITIAL_POMODORO)
  const [pomoStatus, setPomoStatus] = useState('Ready — pick a language and start a focus block')
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [manualForm, setManualForm] = useState({ language: 'JavaScript', minutes: '30', date: localDateKey(), subject: '' })
  const [customForm, setCustomForm] = useState({ work: '25', break: '5' })
  const [modalError, setModalError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const completionInProgress = useRef(false)

  const loadCodingWorkspace = useCallback(async () => {
    setIsLoading(true)
    setActionError('')
    const [sessionsResult, semestersResult] = await Promise.allSettled([
      codingRequests.list(),
      semesterRequests.list(),
    ])

    if (sessionsResult.status === 'fulfilled') {
      setSessions(sortSessions(sessionsResult.value))
    } else {
      setActionError(getErrorMessage(sessionsResult.reason, 'Unable to load your coding sessions.'))
    }

    if (semestersResult.status === 'fulfilled') {
      setSubjects(semestersResult.value.flatMap((semester) => (semester.subjects || []).map((subject) => subject.name)))
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => { void loadCodingWorkspace() }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadCodingWorkspace])

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(new Date()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!freeTimer.running || !freeTimer.startedAt) return undefined
    const interval = window.setInterval(() => {
      setFreeTimer((current) => ({ ...current, elapsed: Math.floor((Date.now() - current.startedAt) / 1000) }))
    }, 500)
    return () => window.clearInterval(interval)
  }, [freeTimer.running, freeTimer.startedAt])

  useEffect(() => {
    if (!pomodoro.running) return undefined
    const interval = window.setInterval(() => {
      setPomodoro((current) => current.remaining <= 1
        ? { ...current, remaining: 0, running: false }
        : { ...current, remaining: current.remaining - 1 })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [pomodoro.running])

  useEffect(() => {
    if (pomodoro.running || pomodoro.remaining !== 0 || completionInProgress.current) return
    completionInProgress.current = true

    const completePhase = async () => {
      if (pomodoro.phase === 'break') {
        setPomodoro((current) => ({
          ...current,
          phase: 'work',
          total: current.workMinutes * 60,
          remaining: current.workMinutes * 60,
          running: false,
        }))
        setPomoStatus('Break over — ready for the next focus block')
        completionInProgress.current = false
        return
      }

      setPomoStatus('Logging your completed focus block…')
      try {
        const session = await codingRequests.create({
          language: pomoLanguage,
          minutes: pomodoro.workMinutes,
          date: new Date().toISOString(),
          source: 'pomodoro',
        })
        setSessions((current) => sortSessions([session, ...current]))
        setPomodoro((current) => ({
          ...current,
          phase: 'break',
          total: current.breakMinutes * 60,
          remaining: current.breakMinutes * 60,
          running: true,
        }))
        setPomoStatus(`Work done — logged ${pomodoro.workMinutes}m of ${pomoLanguage}. Break started.`)
      } catch (error) {
        setActionError(getErrorMessage(error, 'Your focus block finished, but it could not be logged.'))
        setPomodoro((current) => ({
          ...current,
          phase: 'work',
          total: current.workMinutes * 60,
          remaining: current.workMinutes * 60,
          running: false,
        }))
        setPomoStatus('Focus block finished — please log it manually and try again.')
      } finally {
        completionInProgress.current = false
      }
    }

    void completePhase()
  }, [pomoLanguage, pomodoro.phase, pomodoro.remaining, pomodoro.running, pomodoro.workMinutes])

  const stats = useMemo(() => {
    const total = sessions.reduce((sum, session) => sum + session.minutes, 0)
    const today = sessions.filter((session) => sameLocalDay(session.date, currentTime)).reduce((sum, session) => sum + session.minutes, 0)
    const cutoff = currentTime.getTime() - (7 * 86400000)
    const week = sessions.filter((session) => new Date(session.date).getTime() >= cutoff).reduce((sum, session) => sum + session.minutes, 0)
    return { total, today, week }
  }, [currentTime, sessions])

  const languageBreakdown = useMemo(() => {
    const totals = {}
    sessions.forEach((session) => {
      totals[session.language] = (totals[session.language] || 0) + session.minutes
    })
    return Object.entries(totals).sort((first, second) => second[1] - first[1])
  }, [sessions])

  const heatmapDays = useMemo(() => {
    const minutesByDay = {}
    sessions.forEach((session) => {
      const key = new Date(session.date).toDateString()
      minutesByDay[key] = (minutesByDay[key] || 0) + session.minutes
    })
    const maxMinutes = Math.max(1, ...Object.values(minutesByDay))
    return Array.from({ length: 90 }, (_, index) => {
      const date = new Date(currentTime)
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (89 - index))
      const minutes = minutesByDay[date.toDateString()] || 0
      const level = minutes === 0 ? 0 : minutes / maxMinutes > 0.66 ? 4 : minutes / maxMinutes > 0.33 ? 3 : minutes / maxMinutes > 0.1 ? 2 : 1
      return { date, minutes, level }
    })
  }, [currentTime, sessions])

  const pomodoroCyclesToday = useMemo(() => sessions.filter((session) => session.source === 'pomodoro' && sameLocalDay(session.date, currentTime)).length, [currentTime, sessions])
  const maximumLanguageMinutes = languageBreakdown[0]?.[1] || 1
  const pomoProgress = pomodoro.total ? Math.round(((pomodoro.total - pomodoro.remaining) / pomodoro.total) * 100) : 0

  const startFreeTimer = () => {
    setActionError('')
    setFreeTimer({ running: true, startedAt: Date.now(), elapsed: 0 })
  }

  const stopFreeTimer = async () => {
    if (!freeTimer.startedAt) return
    const minutes = Math.max(1, Math.round((Date.now() - freeTimer.startedAt) / 60000))
    setFreeTimer((current) => ({ ...current, running: false, elapsed: Math.floor((Date.now() - current.startedAt) / 1000) }))
    setPendingAction('free-timer')
    setActionError('')
    try {
      const session = await codingRequests.create({ language: timerLanguage, minutes, date: new Date().toISOString(), source: 'timer' })
      setSessions((current) => sortSessions([session, ...current]))
      setFreeTimer({ running: false, startedAt: null, elapsed: 0 })
    } catch (error) {
      setFreeTimer((current) => ({ ...current, running: false }))
      setActionError(getErrorMessage(error, 'Unable to log this timer session.'))
    } finally {
      setPendingAction('')
    }
  }

  const setPomodoroPreset = (preset) => {
    if (pomodoro.running) return
    const durations = preset === 'long' ? { work: 50, break: 10 } : { work: 25, break: 5 }
    setPomodoro({ preset, phase: 'work', workMinutes: durations.work, breakMinutes: durations.break, total: durations.work * 60, remaining: durations.work * 60, running: false })
    setPomoStatus('Ready — pick a language and start a focus block')
  }

  const startPomodoro = () => {
    completionInProgress.current = false
    setPomodoro((current) => ({ ...current, remaining: current.remaining || current.total, running: true }))
    setPomoStatus(pomodoro.phase === 'work' ? 'Focus — stay on task' : 'Break — stretch, hydrate')
  }

  const pausePomodoro = () => {
    setPomodoro((current) => ({ ...current, running: false }))
    setPomoStatus('Paused — resume when you are ready')
  }

  const resetPomodoro = () => {
    completionInProgress.current = false
    setPomodoro((current) => ({ ...current, phase: 'work', total: current.workMinutes * 60, remaining: current.workMinutes * 60, running: false }))
    setPomoStatus('Ready — pick a language and start a focus block')
  }

  const saveCustomPomodoro = (event) => {
    event.preventDefault()
    const workMinutes = Number(customForm.work)
    const breakMinutes = Number(customForm.break)
    if (!Number.isInteger(workMinutes) || workMinutes < 1 || workMinutes > 120 || !Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > 60) {
      setModalError('Work must be 1–120 minutes and break must be 1–60 minutes.')
      return
    }
    setPomodoro({ preset: 'custom', phase: 'work', workMinutes, breakMinutes, total: workMinutes * 60, remaining: workMinutes * 60, running: false })
    setPomoStatus('Ready — pick a language and start a focus block')
    setModalError('')
    setCustomModalOpen(false)
  }

  const openManualModal = () => {
    setManualForm({ language: timerLanguage, minutes: '30', date: localDateKey(), subject: '' })
    setModalError('')
    setManualModalOpen(true)
  }

  const saveManualSession = async (event) => {
    event.preventDefault()
    const minutes = Number(manualForm.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      setModalError('Enter a whole number between 1 and 1440 minutes.')
      return
    }
    if (!manualForm.date) {
      setModalError('Choose the session date.')
      return
    }

    setModalError('')
    setPendingAction('manual-session')
    try {
      const date = new Date(`${manualForm.date}T12:00:00`)
      const session = await codingRequests.create({
        language: manualForm.language,
        minutes,
        date: date.toISOString(),
        subject: manualForm.subject || null,
        source: 'manual',
      })
      setSessions((current) => sortSessions([session, ...current]))
      setManualModalOpen(false)
    } catch (error) {
      setModalError(getErrorMessage(error, 'Unable to save this coding session.'))
    } finally {
      setPendingAction('')
    }
  }

  const deleteSession = async (sessionId) => {
    setPendingAction(`delete-${sessionId}`)
    setActionError('')
    try {
      await codingRequests.remove(sessionId)
      setSessions((current) => current.filter((session) => session._id !== sessionId))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to delete this coding session.'))
    } finally {
      setPendingAction('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1180px] px-5 pb-24 pt-5">
        <WorkspaceHeader activeTab="Coding Time" />
        <div className="mb-[14px] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="m-0 text-[24px] font-bold">Coding Time</h1>
          <p className="m-0 text-[12px] text-slate-400">Track hours per language · Pomodoro focus</p>
        </div>

        <ErrorNotice message={actionError} onDismiss={() => setActionError('')} />
        {isLoading ? <LoadingState /> : <>
          <section className={`${cardClass} mb-[14px]`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="m-0 text-[11px] font-bold uppercase tracking-[0.1em] text-violet-300">Focus</p>
                <p className="mt-0.5 mb-0 font-display text-[15px] font-semibold">{pomodoro.phase === 'work' ? 'Work' : 'Break'} · {formatPomodoroClock(pomodoro.remaining)}</p>
              </div>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setPomodoroPreset('work')} disabled={pomodoro.running} className={pomodoro.preset === 'work' ? primaryButtonClass : buttonClass}>25/5</button>
                <button type="button" onClick={() => setPomodoroPreset('long')} disabled={pomodoro.running} className={pomodoro.preset === 'long' ? primaryButtonClass : buttonClass}>50/10</button>
                <button type="button" onClick={() => { setCustomForm({ work: String(pomodoro.workMinutes), break: String(pomodoro.breakMinutes) }); setModalError(''); setCustomModalOpen(true) }} disabled={pomodoro.running} title="Custom focus duration" className={pomodoro.preset === 'custom' ? primaryButtonClass : buttonClass}>⚙</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-[132px] font-mono text-[36px] font-semibold tracking-[0.03em] text-cyan-400 [text-shadow:0_0_12px_rgba(167,139,250,0.35)]">{formatPomodoroClock(pomodoro.remaining)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={pomoLanguage} onChange={(event) => setPomoLanguage(event.target.value)} disabled={pomodoro.running} title="Language to log when work ends" className="rounded-lg border border-white/[0.10] bg-white/[0.045] px-2.5 py-2 text-[13px] text-slate-100 outline-none transition focus:border-cyan-400/60 disabled:opacity-55 [color-scheme:dark]">
                  {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
                {!pomodoro.running && <button type="button" onClick={startPomodoro} className={primaryButtonClass}>▶ Start</button>}
                {pomodoro.running && <button type="button" onClick={pausePomodoro} className={buttonClass}>Pause</button>}
                {(pomodoro.running || pomodoro.remaining !== pomodoro.total) && <button type="button" onClick={resetPomodoro} className="inline-flex items-center justify-center rounded-lg border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-[12.5px] font-semibold text-rose-100 transition hover:bg-rose-400/16">Reset</button>}
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-linear-to-r from-violet-400 to-cyan-400 transition-[width] duration-300" style={{ width: `${pomoProgress}%` }} /></div>
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11.5px] text-slate-400"><span>{pomoStatus}</span><span>{pomodoroCyclesToday} cycle{pomodoroCyclesToday === 1 ? '' : 's'} today</span></div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[132px] font-mono text-[26px] font-semibold tracking-[0.03em] text-cyan-400 [text-shadow:0_0_12px_rgba(167,139,250,0.35)]">{formatClock(freeTimer.elapsed)}</div>
                <select value={timerLanguage} onChange={(event) => setTimerLanguage(event.target.value)} disabled={freeTimer.running || pendingAction === 'free-timer'} className="rounded-lg border border-white/[0.10] bg-white/[0.045] px-2.5 py-2 text-[13px] text-slate-100 outline-none transition focus:border-cyan-400/60 disabled:opacity-55 [color-scheme:dark]">
                  {LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
              </div>
              {!freeTimer.running ? <button type="button" onClick={startFreeTimer} disabled={pendingAction === 'free-timer'} className={primaryButtonClass}>▶ Start</button> : <button type="button" onClick={() => void stopFreeTimer()} disabled={pendingAction === 'free-timer'} className="inline-flex items-center justify-center rounded-lg border border-rose-300/35 bg-rose-400/10 px-3 py-2 text-[12.5px] font-semibold text-rose-100 transition hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-55">{pendingAction === 'free-timer' ? 'Logging…' : '■ Stop & Log'}</button>}
            </div>
            <p className="mb-0 mt-2 text-[11.5px] text-slate-400">Free timer — runs until you stop and log</p>
          </section>

          <section className="mt-[14px] grid gap-[14px] sm:grid-cols-3">
            {[['Total logged', formatMinutes(stats.total)], ['Today', formatMinutes(stats.today)], ['Last 7 days', formatMinutes(stats.week)]].map(([label, value]) => <div key={label} className={cardClass}><p className="m-0 text-[28px] font-bold text-slate-100">{value}</p><p className="mb-0 mt-1 text-[12px] text-slate-400">{label}</p></div>)}
          </section>

          <h2 className="mb-2 mt-5 flex items-center gap-2 text-[14px] font-semibold"><span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#a78bfa]" />By Language</h2>
          <section className={cardClass}>
            {languageBreakdown.length ? <div>{languageBreakdown.map(([language, minutes]) => <div key={language} className="flex items-center gap-2.5 py-[9px]"><span className="w-[110px] shrink-0 text-[13px] font-semibold">{language}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.round((minutes / maximumLanguageMinutes) * 100)}%`, background: COLOR_BY_LANGUAGE[language] || '#a78bfa' }} /></div><span className="w-16 shrink-0 text-right text-[12px] text-slate-400">{formatMinutes(minutes)}</span></div>)}</div> : <p className="m-0 py-2 text-[13px] text-slate-400">No sessions logged yet — start the timer above.</p>}
          </section>

          <h2 className="mb-2 mt-5 flex items-center gap-2 text-[14px] font-semibold"><span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]" />Last 90 Days</h2>
          <section className={cardClass}>
            <div className="grid max-w-full grid-flow-col grid-rows-7 gap-[3px] overflow-x-auto pb-1">{heatmapDays.map(({ date, minutes, level }) => <div key={date.toISOString()} title={`${date.toLocaleDateString()}: ${formatMinutes(minutes)}`} className="h-[11px] w-[11px] rounded-[3px]" style={{ background: ['rgb(255 255 255 / 6%)', 'rgb(167 139 250 / 35%)', 'rgb(167 139 250 / 60%)', 'rgb(167 139 250 / 85%)', '#a78bfa'][level] }} />)}</div>
            <p className="mb-0 mt-2 text-[10.5px] text-slate-400">{heatmapDays[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} → Today ({heatmapDays[heatmapDays.length - 1].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}) · Past 90 days</p>
          </section>

          <div className="mb-3 mt-5 flex items-center justify-between gap-3"><h2 className="m-0 flex items-center gap-2 text-[14px] font-semibold"><span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#ffb86b]" />Recent Sessions</h2><button type="button" onClick={openManualModal} className={buttonClass}>+ Log manually</button></div>
          <section className={cardClass}>
            {sessions.length ? sessions.slice(0, 12).map((session) => <div key={session._id} className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.09] py-[9px] last:border-b-0"><div className="flex min-w-0 items-center gap-2.5 text-[13px]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_BY_LANGUAGE[session.language] || '#a78bfa' }} /><span className="truncate">{session.language}{session.subject ? ` · ${session.subject}` : ''}</span><span className="shrink-0 text-[11.5px] text-slate-500">· {formatSessionDate(session.date)}</span></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-0.5 text-[11.5px] text-slate-300">{formatMinutes(session.minutes)}</span><button type="button" onClick={() => void deleteSession(session._id)} disabled={pendingAction === `delete-${session._id}`} aria-label={`Delete ${session.language} session`} className="grid h-[26px] w-[26px] place-items-center rounded-lg border border-transparent text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-55">{pendingAction === `delete-${session._id}` ? '…' : '🗑'}</button></div></div>) : <p className="m-0 py-2 text-[13px] text-slate-400">Nothing logged yet.</p>}
          </section>
        </>}
      </div>

      {manualModalOpen && <div role="dialog" aria-modal="true" aria-labelledby="manual-session-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5"><form onSubmit={(event) => void saveManualSession(event)} className="w-full max-w-[400px] rounded-[18px] border border-white/[0.14] bg-slate-900 p-5 shadow-2xl"><h2 id="manual-session-title" className="m-0 text-[18px]">Log a Coding Session</h2><div className="mt-4 space-y-3"><label className="block text-[12px] font-semibold text-slate-300">Language<select value={manualForm.language} onChange={(event) => setManualForm((current) => ({ ...current, language: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60 [color-scheme:dark]">{LANGUAGES.map((language) => <option key={language} value={language}>{language}</option>)}</select></label><label className="block text-[12px] font-semibold text-slate-300">Minutes<input type="number" min="1" max="1440" value={manualForm.minutes} onChange={(event) => setManualForm((current) => ({ ...current, minutes: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60" /></label><label className="block text-[12px] font-semibold text-slate-300">Date<input type="date" value={manualForm.date} onChange={(event) => setManualForm((current) => ({ ...current, date: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60 [color-scheme:dark]" /></label><label className="block text-[12px] font-semibold text-slate-300">Subject (optional)<select value={manualForm.subject} onChange={(event) => setManualForm((current) => ({ ...current, subject: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60 [color-scheme:dark]"><option value="">None</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select></label></div>{modalError && <p role="alert" className="mb-0 mt-3 text-sm text-rose-200">{modalError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { if (!pendingAction) setManualModalOpen(false) }} disabled={pendingAction === 'manual-session'} className={buttonClass}>Cancel</button><button type="submit" disabled={pendingAction === 'manual-session'} className={primaryButtonClass}>{pendingAction === 'manual-session' ? 'Saving…' : 'Save'}</button></div></form></div>}

      {customModalOpen && <div role="dialog" aria-modal="true" aria-labelledby="custom-focus-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5"><form onSubmit={saveCustomPomodoro} className="w-full max-w-[360px] rounded-[18px] border border-white/[0.14] bg-slate-900 p-5 shadow-2xl"><h2 id="custom-focus-title" className="m-0 text-[18px]">Custom Focus</h2><div className="mt-4 flex gap-3"><label className="block flex-1 text-[12px] font-semibold text-slate-300">Work (minutes)<input type="number" min="1" max="120" value={customForm.work} onChange={(event) => setCustomForm((current) => ({ ...current, work: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60" /></label><label className="block flex-1 text-[12px] font-semibold text-slate-300">Break (minutes)<input type="number" min="1" max="60" value={customForm.break} onChange={(event) => setCustomForm((current) => ({ ...current, break: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60" /></label></div>{modalError && <p role="alert" className="mb-0 mt-3 text-sm text-rose-200">{modalError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCustomModalOpen(false)} className={buttonClass}>Cancel</button><button type="submit" className={primaryButtonClass}>Save</button></div></form></div>}
    </main>
  )
}
