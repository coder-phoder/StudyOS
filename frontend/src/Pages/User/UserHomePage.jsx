import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import WorkspaceHeader from '../../Components/Common/WorkspaceHeader'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const QUOTES = [
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: '' },
  { text: 'Small steps every day beat perfect plans you never start.', author: '' },
  { text: 'The pain of studying is temporary. The regret of not studying is permanent.', author: '' },
  { text: 'You do not have to be great to start, but you have to start to be great.', author: 'Zig Ziglar' },
  { text: 'Focus on progress, not perfection.', author: '' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: '' },
]

const LANGUAGE_COLORS = ['#a78bfa', '#ffb86b', '#fb923c', '#4ade80', '#c084fc', '#f5f0e6']
const EMPTY_DASHBOARD = { semesters: [], sessions: [], events: [], todos: [], goals: [] }
const CARD_CLASS = "relative overflow-hidden rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.6)] before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-br before:from-white/[0.05] before:to-transparent before:content-['']"
const BUTTON_CLASS = 'inline-flex items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-[15px] py-[9px] text-[13px] font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.075] focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60'

const getResponseData = (response, fallbackMessage) => {
  if (!response.data?.success) throw new Error(response.data?.message || fallbackMessage)
  return response.data.data || {}
}

const dashboardRequests = {
  load: async () => {
    const [semesterResponse, sessionResponse, eventResponse, todoResponse, goalResponse] = await Promise.all([
      api.get('/api/semesters'),
      api.get('/api/coding-sessions'),
      api.get('/api/calendar/events'),
      api.get('/api/todos'),
      api.get('/api/goals'),
    ])
    const semesters = getResponseData(semesterResponse, 'Unable to load semesters')
    const sessions = getResponseData(sessionResponse, 'Unable to load coding sessions')
    const events = getResponseData(eventResponse, 'Unable to load calendar events')
    const todos = getResponseData(todoResponse, 'Unable to load to-dos')
    const goals = getResponseData(goalResponse, 'Unable to load goals')

    return {
      semesters: semesters.semesters || [],
      sessions: sessions.sessions || [],
      events: events.events || [],
      todos: todos.todos || [],
      goals: goals.goals || [],
    }
  },
  createGoal: async (payload) => (await getResponseData(await api.post('/api/goals', payload), 'Unable to create goal')).goal,
  updateGoal: async (goalId, payload) => (await getResponseData(await api.put('/api/goals/' + goalId, payload), 'Unable to update goal')).goal,
  deleteGoal: async (goalId) => getResponseData(await api.delete('/api/goals/' + goalId), 'Unable to delete goal'),
}

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const getLocalDateKey = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

const calendarDate = (value) => new Date(value + 'T00:00:00')

const startOfDay = (value = new Date()) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const formatMinutes = (minutes) => {
  if (minutes < 60) return Math.round(minutes) + 'm'
  const hours = minutes / 60
  return (hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10) + 'h'
}

const formatMonth = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date)
    : ''
}

const isDateWithinNextWeek = (value) => {
  if (!value) return false
  const date = startOfDay(value)
  const today = startOfDay()
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return date >= today && date <= weekEnd
}

const getDashboardMetrics = ({ semesters, sessions, events, todos, goals }) => {
  const topics = semesters.flatMap((semester) => (semester.subjects || []).flatMap((subject) => (subject.topics || []).map((topic) => ({
    ...topic,
    semester: semester.name,
    subject: subject.name,
  }))))
  const completeTopics = topics.filter((topic) => topic.completed).length
  const totalTopics = topics.length
  const progress = totalTopics ? Math.round((completeTopics / totalTopics) * 100) : 0
  const subjectCount = semesters.reduce((count, semester) => count + (semester.subjects || []).length, 0)
  const now = Date.now()
  const weeklyMinutes = sessions
    .filter((session) => new Date(session.date).getTime() >= now - (7 * 24 * 60 * 60 * 1000))
    .reduce((total, session) => total + session.minutes, 0)

  const activityDays = new Set([
    ...sessions.map((session) => new Date(session.date).toDateString()),
    ...events.map((event) => calendarDate(event.date).toDateString()),
  ])
  const streakCursor = startOfDay()
  if (!activityDays.has(streakCursor.toDateString())) streakCursor.setDate(streakCursor.getDate() - 1)
  let streak = 0
  while (activityDays.has(streakCursor.toDateString())) {
    streak += 1
    streakCursor.setDate(streakCursor.getDate() - 1)
  }

  const todayKey = getLocalDateKey()
  const todayEvents = events
    .filter((event) => event.date === todayKey)
    .sort((first, second) => (first.time || '').localeCompare(second.time || ''))
  const today = startOfDay()
  const nextExam = events
    .filter((event) => event.isExam && calendarDate(event.date) >= today)
    .sort((first, second) => calendarDate(first.date) - calendarDate(second.date))[0] || null
  const daysUntilExam = nextExam ? Math.ceil((calendarDate(nextExam.date) - today) / 86400000) : null

  let weightedGrades = 0
  let totalCredits = 0
  const unweightedGrades = []
  semesters.forEach((semester) => {
    ;(semester.subjects || []).forEach((subject) => {
      if (subject.grade === null || subject.grade === undefined || subject.grade === '') return
      const rawGrade = Number(subject.grade)
      if (!Number.isFinite(rawGrade)) return
      const grade = rawGrade > 10 ? rawGrade / 10 : rawGrade
      const credits = Number(subject.credits)
      if (Number.isFinite(credits) && credits > 0) {
        weightedGrades += grade * credits
        totalCredits += credits
      } else {
        unweightedGrades.push(grade)
      }
    })
  })
  unweightedGrades.forEach((grade) => {
    weightedGrades += grade
    totalCredits += 1
  })
  const gradeAverage = totalCredits ? Math.round((weightedGrades / totalCredits) * 100) / 100 : null

  const primaryGoal = goals.find((goal) => !goal.completed && goal.targetCgpa !== null && goal.targetCgpa !== undefined)
    || goals.find((goal) => !goal.completed)
    || goals[0]
    || null
  const goalCurrentCgpa = primaryGoal?.currentCgpa ?? gradeAverage
  const goalTargetCgpa = primaryGoal?.targetCgpa ?? null
  const goalProgress = goalCurrentCgpa !== null && goalCurrentCgpa !== undefined && goalTargetCgpa > 0
    ? Math.min(100, Math.round((goalCurrentCgpa / goalTargetCgpa) * 100))
    : 0

  const pendingTopics = [...topics.filter((topic) => !topic.completed)].sort((first, second) => {
    if (first.dueDate && second.dueDate) return new Date(first.dueDate) - new Date(second.dueDate)
    if (first.dueDate) return -1
    if (second.dueDate) return 1
    return 0
  }).slice(0, 6)
  const pendingTodos = todos.filter((todo) => !todo.completed).slice(0, 6)
  const pomodoroCycles = sessions.filter((session) => session.source === 'pomodoro' && getLocalDateKey(new Date(session.date)) === todayKey).length
  const dueThisWeek = topics.filter((topic) => !topic.completed && isDateWithinNextWeek(topic.dueDate)).length

  const languageMinutes = sessions.reduce((totals, session) => ({
    ...totals,
    [session.language]: (totals[session.language] || 0) + session.minutes,
  }), {})
  const languages = Object.entries(languageMinutes).sort((first, second) => second[1] - first[1]).slice(0, 5)
  const languageTotal = languages.reduce((total, [, minutes]) => total + minutes, 0)
  const weekdayMinutes = Array(7).fill(0)
  sessions.forEach((session) => {
    const date = new Date(session.date)
    if (date.getTime() >= now - (7 * 24 * 60 * 60 * 1000)) weekdayMinutes[date.getDay()] += session.minutes
  })

  return {
    completeTopics,
    totalTopics,
    progress,
    subjectCount,
    weeklyMinutes,
    streak,
    todayEvents,
    nextExam,
    daysUntilExam,
    gradeAverage,
    primaryGoal,
    goalCurrentCgpa,
    goalTargetCgpa,
    goalProgress,
    pendingTopics,
    pendingTodos,
    pomodoroCycles,
    dueThisWeek,
    languages,
    languageTotal,
    weekdayMinutes,
  }
}

export default function UserHomePage() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionError, setActionError] = useState('')
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({ text: '', targetCgpa: '', currentCgpa: '', targetDate: '' })
  const [pendingGoalAction, setPendingGoalAction] = useState('')
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * QUOTES.length))

  const metrics = useMemo(() => getDashboardMetrics(dashboard), [dashboard])
  const quote = QUOTES[quoteIndex]

  const loadDashboard = useCallback(async (refresh = false) => {
    setActionError('')
    if (refresh) setIsRefreshing(true)
    else setIsLoading(true)
    try {
      setDashboard(await dashboardRequests.load())
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to load your dashboard. Please try again.'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQuoteIndex((current) => (current + 1) % QUOTES.length)
    }, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const rotateQuote = () => setQuoteIndex((current) => (current + 1) % QUOTES.length)

  const replaceGoal = (goal) => {
    setDashboard((current) => ({
      ...current,
      goals: current.goals.map((item) => (item._id === goal._id ? goal : item)),
    }))
  }

  const toggleGoal = async (goal) => {
    setActionError('')
    setPendingGoalAction('toggle-' + goal._id)
    try {
      replaceGoal(await dashboardRequests.updateGoal(goal._id, { completed: !goal.completed }))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to update this goal.'))
    } finally {
      setPendingGoalAction('')
    }
  }

  const deleteGoal = async (goalId) => {
    setActionError('')
    setPendingGoalAction('delete-' + goalId)
    try {
      await dashboardRequests.deleteGoal(goalId)
      setDashboard((current) => ({ ...current, goals: current.goals.filter((goal) => goal._id !== goalId) }))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to delete this goal.'))
    } finally {
      setPendingGoalAction('')
    }
  }

  const createGoal = async (event) => {
    event.preventDefault()
    if (!goalForm.text.trim()) {
      setActionError('Enter a goal before adding it.')
      return
    }

    setActionError('')
    setPendingGoalAction('create')
    try {
      const goal = await dashboardRequests.createGoal({
        text: goalForm.text.trim(),
        targetCgpa: goalForm.targetCgpa === '' ? null : Number(goalForm.targetCgpa),
        currentCgpa: goalForm.currentCgpa === '' ? null : Number(goalForm.currentCgpa),
        targetDate: goalForm.targetDate || null,
      })
      setDashboard((current) => ({ ...current, goals: [goal, ...current.goals] }))
      setGoalForm({ text: '', targetCgpa: '', currentCgpa: '', targetDate: '' })
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to add this goal.'))
    } finally {
      setPendingGoalAction('')
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1180px] px-5 pb-24 pt-5">
        <WorkspaceHeader activeTab="Dashboard" />

        {actionError && <div role="alert" className="mb-[14px] flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"><span>{actionError}</span><button type="button" onClick={() => void loadDashboard(true)} disabled={isRefreshing} className="font-semibold underline underline-offset-2 hover:text-white disabled:opacity-60">{isRefreshing ? 'Retrying…' : 'Retry'}</button></div>}

        {isLoading ? <DashboardLoading /> : <>
          <section className="mb-[14px] grid grid-cols-1 items-stretch gap-[14px] min-[561px]:grid-cols-2 min-[981px]:grid-cols-[1fr_1fr_auto_1.3fr]">
            <StatTile label="Degree Progress" value={metrics.progress} unit="%" tone="violet" />
            <StatTile label="Coding This Week" value={Math.round((metrics.weeklyMinutes / 60) * 10) / 10} unit="h" tone="green" />
            <div className="flex flex-row justify-center gap-2 min-[561px]:flex-col min-[561px]:gap-2.5">
              <MiniPill icon="📚" value={metrics.subjectCount} label="Subjects" />
              <MiniPill icon="🗓" value={dashboard.semesters.length} label="Semesters" />
              <MiniPill icon="🔥" value={metrics.streak} label="Day Streak" />
            </div>
            <section className={CARD_CLASS + ' col-span-full m-0 px-7 py-[26px] min-[981px]:col-span-1'}>
              <div className="relative">
                <span className="mb-1.5 block font-serif text-[44px] leading-[0.5] text-violet-400/55">&quot;</span>
                <p className="m-0 font-serif text-[18px] font-medium italic leading-[1.55] tracking-[0.01em] text-slate-100 min-[641px]:text-[23px]">{quote.text}</p>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="font-display text-[11px] uppercase tracking-[0.12em] text-slate-400">{quote.author ? '— ' + quote.author : ''}</span>
                  <button type="button" onClick={rotateQuote} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.045] hover:text-slate-100">↻ New</button>
                </div>
              </div>
            </section>
          </section>

          {metrics.nextExam && <div className="mb-[14px] rounded-[12px] border border-amber-300/35 bg-amber-300/14 px-4 py-2.5 text-[13px] font-semibold text-amber-300">📌 {metrics.daysUntilExam === 0 ? metrics.nextExam.subject + ' exam is today' : metrics.daysUntilExam + ' day' + (metrics.daysUntilExam === 1 ? '' : 's') + ' until ' + metrics.nextExam.subject + ' exam'}</div>}

          <section className={CARD_CLASS + ' mb-[14px] bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,255,255,0.045))]'}>
            <div className="relative">
              <div className="mb-2.5 flex items-start justify-between gap-3">
                <p className="m-0 text-[10px] font-bold tracking-[0.12em] text-violet-300">GOALS</p>
                <button type="button" onClick={() => setGoalModalOpen(true)} className="rounded-lg px-2 py-1 text-[12px] font-semibold text-slate-400 transition hover:bg-white/[0.045] hover:text-slate-100">+ Add / Edit</button>
              </div>
              {dashboard.goals.length ? <div>{dashboard.goals.map((goal) => <GoalRow key={goal._id} goal={goal} isPending={Boolean(pendingGoalAction)} onToggle={toggleGoal} onDelete={deleteGoal} />)}</div> : <p className="m-0 py-1 text-[13px] text-slate-400">No goals yet — add one.</p>}
              <div className="mt-[14px] flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400 transition-[width] duration-300" style={{ width: metrics.goalProgress + '%' }} /></div>
                <span title={metrics.primaryGoal?.currentCgpa === null && metrics.gradeAverage !== null ? 'Auto-calculated from subject grades' : undefined} className="shrink-0 font-display text-[12.5px] font-bold text-slate-400">{metrics.goalCurrentCgpa !== null && metrics.goalCurrentCgpa !== undefined ? metrics.goalTargetCgpa ? metrics.goalCurrentCgpa + ' / ' + metrics.goalTargetCgpa : 'Avg ' + metrics.goalCurrentCgpa : metrics.goalTargetCgpa ? '— / ' + metrics.goalTargetCgpa : '—'}</span>
              </div>
            </div>
          </section>

          <DashboardSectionTitle label="This Week" tone="green" outerClass="mt-2" />
          <section className="mb-[14px] grid grid-cols-1 gap-3 min-[721px]:grid-cols-2 min-[721px]:[grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
            <WeeklyStat value={formatMinutes(metrics.weeklyMinutes)} label="Coded" />
            <WeeklyStat value={metrics.completeTopics + '/' + metrics.totalTopics} label="Topics done" />
            <WeeklyStat value={metrics.pomodoroCycles} label="Focus cycles today" />
            <WeeklyStat value={metrics.dueThisWeek} label="Due in 7 days" />
            <WeeklyStat value={dashboard.todos.filter((todo) => !todo.completed).length} label="Open to-dos" />
            <WeeklyStat value={metrics.streak + 'd' + (metrics.gradeAverage !== null ? ' · ' + metrics.gradeAverage : '')} label={'Streak' + (metrics.gradeAverage !== null ? ' · GPA' : '')} />
          </section>

          <section className="grid grid-cols-1 gap-[14px] min-[561px]:grid-cols-3">
            <DashboardList title="Today's Timetable" tone="cyan" empty="Nothing on the calendar for today.">
              {metrics.todayEvents.map((event) => <div key={event._id} className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.09] py-2.5 last:border-b-0"><span className="text-[13px] text-slate-300">{event.time || '—'}</span><span className="rounded-full bg-cyan-400/14 px-2.5 py-[3px] text-[11px] font-semibold text-cyan-400">{event.subject}</span></div>)}
            </DashboardList>
            <DashboardList title="Pending Topics" tone="amber" empty="All caught up — add topics in Semesters.">
              {metrics.pendingTopics.map((topic) => <div key={topic._id} className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.09] py-2.5 last:border-b-0"><span className="min-w-0 truncate text-[13px] text-slate-300">{topic.name}</span><TopicPill topic={topic} /></div>)}
            </DashboardList>
            <DashboardList title="To-Do List" tone="violet" empty="Nothing on your list 🎉">
              {metrics.pendingTodos.map((todo) => <div key={todo._id} className="flex items-center justify-between gap-3 border-b border-dashed border-white/[0.09] py-2.5 last:border-b-0"><span className="min-w-0 truncate text-[13px] text-slate-300">{todo.text}</span></div>)}
            </DashboardList>
          </section>

          <section className="mt-[14px] grid grid-cols-1 gap-[14px] min-[601px]:grid-cols-2 min-[901px]:grid-cols-3">
            <ProgressCard completed={metrics.completeTopics} total={metrics.totalTopics} progress={metrics.progress} />
            <LanguageCard languages={metrics.languages} total={metrics.languageTotal} />
            <WeekChart totals={metrics.weekdayMinutes} />
          </section>
        </>}
      </div>

      {goalModalOpen && <GoalModal goals={dashboard.goals} form={goalForm} pendingAction={pendingGoalAction} onChange={(field, value) => setGoalForm((current) => ({ ...current, [field]: value }))} onClose={() => { if (!pendingGoalAction) setGoalModalOpen(false) }} onCreate={createGoal} onDelete={deleteGoal} />}
    </main>
  )
}

function DashboardLoading() {
  return <div className={CARD_CLASS + ' grid min-h-72 place-items-center'}><p className="relative text-sm text-slate-400">Loading your dashboard…</p></div>
}

function StatTile({ label, value, unit, tone }) {
  const toneClass = tone === 'green'
    ? 'bg-[linear-gradient(135deg,#34d399,#10b981_55%,#059669)]'
    : 'bg-[linear-gradient(135deg,#9d5cf0,#7c3aed_55%,#6423d4)]'

  return <section className={"relative flex min-h-[118px] flex-col justify-between overflow-hidden rounded-[18px] px-[22px] py-5 shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-br before:from-[#f3ead9]/[0.16] before:to-transparent before:content-[''] " + toneClass}>
    <p className="relative m-0 text-[12.5px] font-semibold tracking-[0.02em] text-white/85">{label}</p>
    <p className="relative m-0 font-display text-[32px] font-bold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.25)]">{value}<span className="ml-1 text-base font-semibold opacity-85">{unit}</span></p>
  </section>
}

function MiniPill({ icon, value, label }) {
  return <div className="flex min-w-[130px] items-center gap-2.5 rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-4 py-2.5">
    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-violet-400/14 text-[15px]">{icon}</span>
    <div>
      <p className="m-0 font-display text-[17px] font-bold leading-[1.1] text-slate-100">{value}</p>
      <p className="m-0 text-[10.5px] uppercase tracking-[0.05em] text-slate-400">{label}</p>
    </div>
  </div>
}

function GoalRow({ goal, isPending, onToggle, onDelete }) {
  const meta = [
    goal.targetCgpa !== null && goal.targetCgpa !== undefined ? 'CGPA ' + (goal.currentCgpa ?? '—') + ' / ' + goal.targetCgpa : '',
    goal.targetDate ? 'by ' + formatMonth(goal.targetDate) : '',
  ].filter(Boolean).join(' · ')
  const isCompleted = goal.completed

  return <div className={"flex items-start gap-2.5 border-b border-dashed border-white/[0.09] py-2 last:border-b-0 " + (isCompleted ? 'opacity-70' : '')}>
    <button type="button" disabled={isPending} onClick={() => void onToggle(goal)} aria-label={(isCompleted ? 'Mark incomplete: ' : 'Mark complete: ') + goal.text} className={"mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-55 " + (isCompleted ? 'border-violet-400 bg-violet-400 text-white' : 'border-violet-400 bg-transparent text-transparent hover:bg-violet-400/14')}>✓</button>
    <div className="min-w-0 flex-1">
      <p className={"m-0 font-display text-[14px] font-semibold leading-[1.35] " + (isCompleted ? 'text-slate-600 line-through' : 'text-slate-100')}>{goal.text}</p>
      {meta && <p className="m-0.5 mt-0 text-[11px] font-medium text-slate-400">{meta}</p>}
    </div>
    <button type="button" disabled={isPending} onClick={() => void onDelete(goal._id)} aria-label={'Delete ' + goal.text} className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-55">×</button>
  </div>
}

function DashboardSectionTitle({ label, tone, outerClass = '' }) {
  const dotClass = tone === 'amber'
    ? 'bg-amber-300 shadow-[0_0_8px_#ffb86b]'
    : tone === 'green'
      ? 'bg-emerald-400 shadow-[0_0_8px_#4ade80]'
      : tone === 'violet'
        ? 'bg-violet-400 shadow-[0_0_8px_#a78bfa]'
        : 'bg-cyan-400 shadow-[0_0_8px_#c4b5fd]'

  return <h2 className={outerClass + ' mb-3 flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.07em] text-slate-400'}><span className={'h-1.5 w-1.5 rounded-full ' + dotClass} />{label}</h2>
}

function WeeklyStat({ value, label }) {
  return <section className="rounded-[14px] border border-white/[0.09] bg-white/[0.045] px-4 py-[14px]">
    <p className="m-0 font-display text-[22px] font-bold text-slate-100">{value}</p>
    <p className="mt-0.5 mb-0 text-[11px] uppercase tracking-[0.05em] text-slate-400">{label}</p>
  </section>
}

function DashboardList({ title, tone, empty, children }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <div>
    <DashboardSectionTitle label={title} tone={tone} />
    <section className={CARD_CLASS + ' max-h-[220px] overflow-y-auto py-2'}>
      <div className="relative">{hasItems ? children : <p className="m-0 px-0 py-2 text-[13px] text-slate-400">{empty}</p>}</div>
    </section>
  </div>
}

function TopicPill({ topic }) {
  if (!topic.dueDate) {
    return <span className="shrink-0 rounded-full bg-amber-300/14 px-2.5 py-[3px] text-[11px] font-semibold text-amber-300">{topic.subject}</span>
  }

  const due = startOfDay(topic.dueDate)
  const difference = Math.round((due - startOfDay()) / 86400000)
  const tone = difference < 0
    ? 'bg-rose-400/14 text-rose-200'
    : difference <= 3
      ? 'bg-amber-300/14 text-amber-300'
      : 'bg-cyan-400/14 text-cyan-400'

  return <span className={'shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-semibold ' + tone}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(due)}</span>
}

function Donut({ children, background }) {
  return <div className="relative h-[130px] w-[130px] shrink-0 rounded-full" style={{ background }}>
    <div className="absolute inset-5 rounded-full bg-[#0a0e16]" />
    <div className="absolute inset-0 z-10 grid place-items-center text-center">{children}</div>
  </div>
}

function ProgressCard({ completed, total, progress }) {
  const background = total
    ? 'conic-gradient(#c4b5fd 0% ' + progress + '%, rgb(255 255 255 / 8%) ' + progress + '% 100%)'
    : 'conic-gradient(rgb(255 255 255 / 8%) 0% 100%)'

  return <section className={CARD_CLASS + ' flex flex-wrap items-center justify-center gap-[18px]'}>
    <div className="relative w-full">
      <DashboardSectionTitle label="Overall Progress" tone="violet" outerClass="mt-0" />
      <div className="flex flex-wrap items-center justify-center gap-[18px]">
        <Donut background={background}><p className="m-0 font-display text-[18px] font-bold text-slate-100">{progress}%<span className="mt-0 block text-[9px] font-normal uppercase tracking-[0.05em] text-slate-400">Done</span></p></Donut>
        <div className="flex min-w-[120px] flex-col gap-2">
          <Legend color="#c4b5fd" label="Done" value={completed} />
          <Legend color="rgb(255 255 255 / 25%)" label="Pending" value={total - completed} />
        </div>
      </div>
    </div>
  </section>
}

function LanguageCard({ languages, total }) {
  let accumulated = 0
  const stops = languages.map(([, minutes], index) => {
    const start = total ? (accumulated / total) * 100 : 0
    accumulated += minutes
    return LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] + ' ' + start + '% ' + ((accumulated / total) * 100) + '%'
  }).join(', ')

  return <section className={CARD_CLASS + ' flex flex-wrap items-center justify-center gap-[18px]'}>
    <div className="relative w-full">
      <DashboardSectionTitle label="Coding by Language" tone="cyan" outerClass="mt-0" />
      <div className="flex flex-wrap items-center justify-center gap-[18px]">
        <Donut background={total ? 'conic-gradient(' + stops + ')' : 'rgb(255 255 255 / 8%)'}>
          <p className="m-0 font-display text-[18px] font-bold text-slate-100">{total ? formatMinutes(total) : '0h'}<span className="mt-0 block text-[9px] font-normal uppercase tracking-[0.05em] text-slate-400">Total</span></p>
        </Donut>
        <div className="flex min-w-[120px] flex-col gap-2">
          {languages.length ? languages.map(([language, minutes], index) => <Legend key={language} color={LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]} label={language} value={formatMinutes(minutes)} />) : <p className="m-0 text-[12px] text-slate-400">No sessions logged yet</p>}
        </div>
      </div>
    </div>
  </section>
}

function Legend({ color, label, value }) {
  return <div className="flex items-center gap-2 text-[12px] text-slate-400">
    <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: color }} />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    <strong className="pl-2.5 text-slate-100">{value}</strong>
  </div>
}

function WeekChart({ totals }) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maximum = Math.max(1, ...totals)

  return <section className={CARD_CLASS}>
    <div className="relative">
      <DashboardSectionTitle label="Coding Time / Week Day" tone="amber" outerClass="mt-0" />
      <div className="flex h-[130px] items-end justify-between gap-2 pt-2.5">
        {labels.map((label, index) => <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div title={formatMinutes(totals[index])} className="min-h-[3px] w-[70%] rounded-t-md bg-linear-to-b from-emerald-400 to-emerald-600 transition-[height] duration-300" style={{ height: Math.round((totals[index] / maximum) * 100) + '%' }} />
          <span className="text-[10px] tracking-[0.03em] text-slate-400">{label}</span>
        </div>)}
      </div>
    </div>
  </section>
}

function GoalModal({ goals, form, pendingAction, onChange, onClose, onCreate, onDelete }) {
  const isBusy = Boolean(pendingAction)

  return <div role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-5">
    <form onSubmit={(event) => void onCreate(event)} className="max-h-[calc(100vh-40px)] w-full max-w-[460px] overflow-y-auto rounded-[18px] border border-white/[0.14] bg-slate-900 p-5 shadow-2xl">
      <h2 id="goal-modal-title" className="m-0 text-[18px]">Goals</h2>

      <div className="my-3 max-h-[220px] overflow-y-auto">
        {goals.length ? goals.map((goal) => <div key={goal._id} className="flex items-start justify-between gap-3 border-b border-white/[0.09] py-2.5 last:border-b-0">
          <div className="min-w-0">
            <p className="m-0 break-words text-[13px] font-semibold text-slate-100">{goal.text}</p>
            <p className="mt-0.5 mb-0 text-[11px] text-slate-400">{goal.targetCgpa !== null && goal.targetCgpa !== undefined ? 'CGPA ' + (goal.currentCgpa ?? '—') + ' / ' + goal.targetCgpa : ''}{goal.targetDate ? ' · by ' + formatMonth(goal.targetDate) : ''}{goal.completed ? ' · done' : ''}</p>
          </div>
          <button type="button" disabled={isBusy} onClick={() => void onDelete(goal._id)} aria-label={'Delete ' + goal.text} className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-55">🗑</button>
        </div>) : <p className="m-0 py-3 text-[13px] text-slate-400">No goals yet.</p>}
      </div>

      <label className="block text-[12px] font-semibold text-slate-300">
        New goal
        <input required value={form.text} onChange={(event) => onChange('text', event.target.value)} placeholder="e.g. Get into Dartmouth as a transfer" className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60" />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] font-semibold text-slate-300">
          Target CGPA (optional)
          <input type="number" min="0" max="10" step="0.1" value={form.targetCgpa} onChange={(event) => onChange('targetCgpa', event.target.value)} placeholder="9.0" className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60" />
        </label>
        <label className="block text-[12px] font-semibold text-slate-300">
          Current CGPA (optional)
          <input type="number" min="0" max="10" step="0.1" value={form.currentCgpa} onChange={(event) => onChange('currentCgpa', event.target.value)} placeholder="auto from grades" className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/60" />
        </label>
      </div>

      <label className="mt-3 block text-[12px] font-semibold text-slate-300">
        Target date (optional)
        <input type="month" value={form.targetDate} onChange={(event) => onChange('targetDate', event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/[0.10] bg-white/[0.045] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/60 [color-scheme:dark]" />
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={isBusy} className={BUTTON_CLASS}>Close</button>
        <button type="submit" disabled={isBusy} className="inline-flex items-center justify-center rounded-[10px] border border-cyan-400 bg-cyan-400 px-[15px] py-[9px] text-[13px] font-bold text-[#04121a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{pendingAction === 'create' ? 'Adding…' : 'Add Goal'}</button>
      </div>
    </form>
  </div>
}
