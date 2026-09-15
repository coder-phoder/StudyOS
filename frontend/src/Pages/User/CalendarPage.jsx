import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import WorkspaceHeader from '../../Components/Common/WorkspaceHeader'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const YEARS = [2026, 2027, 2028]
const PRIORITY_COLOR = { high: '#ff6b6b', medium: '#ffb86b', low: '#4ade80' }
const NEXT_PRIORITY = { high: 'medium', medium: 'low', low: 'high' }

const getResponseData = (response, fallbackMessage) => {
  if (!response.data?.success) throw new Error(response.data?.message || fallbackMessage)
  return response.data.data || {}
}

const calendarRequests = {
  events: async () => (await getResponseData(await api.get('/api/calendar/events'), 'Unable to load calendar events')).events || [],
  createEvents: async (payload) => (await getResponseData(await api.post('/api/calendar/events', payload), 'Unable to add calendar event')).events || [],
  deleteEvent: async (eventId) => getResponseData(await api.delete(`/api/calendar/events/${eventId}`), 'Unable to delete calendar event'),
}

const todoRequests = {
  list: async () => (await getResponseData(await api.get('/api/todos'), 'Unable to load to-do list')).todos || [],
  create: async (payload) => (await getResponseData(await api.post('/api/todos', payload), 'Unable to add task')).todo,
  update: async (todoId, payload) => (await getResponseData(await api.put(`/api/todos/${todoId}`, payload), 'Unable to update task')).todo,
  reorder: async (orderedIds) => (await getResponseData(await api.put('/api/todos/reorder', { orderedIds }), 'Unable to reorder tasks')).todos || [],
  remove: async (todoId) => getResponseData(await api.delete(`/api/todos/${todoId}`), 'Unable to delete task'),
}

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const localDateKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')

const dateFromKey = (dateKey) => new Date(`${dateKey}T00:00:00`)

const formatLongDate = (dateKey) => new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(dateFromKey(dateKey))

const formatAgendaDate = (date) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric',
}).format(date)

const monthLabel = (year, month) => new Intl.DateTimeFormat(undefined, {
  month: 'long', year: 'numeric',
}).format(new Date(year, month, 1))

const toEventMap = (events) => events.reduce((map, event) => {
  if (!map[event.date]) map[event.date] = []
  map[event.date].push(event)
  return map
}, {})

const sortEvents = (events) => [...events].sort((first, second) => `${first.date} ${first.time || ''}`.localeCompare(`${second.date} ${second.time || ''}`))

const sortTodosForDisplay = (todos) => [...todos].sort((first, second) => {
  if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed)
  return first.order - second.order
})

function CheckIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><polyline points="20 6 9 17 4 12" /></svg>
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" /></svg>
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const initialYear = YEARS.includes(today.getFullYear()) ? today.getFullYear() : YEARS[0]
  const [calendarYear, setCalendarYear] = useState(initialYear)
  const [calendarMonth, setCalendarMonth] = useState(initialYear === today.getFullYear() ? today.getMonth() : 0)
  const [viewMode, setViewMode] = useState('month')
  const [events, setEvents] = useState([])
  const [todos, setTodos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [eventModalDate, setEventModalDate] = useState('')
  const [eventForm, setEventForm] = useState({ subject: '', time: '', room: '', isExam: false, recurring: false, repeatWeeks: '8' })
  const [eventAction, setEventAction] = useState('')
  const [modalError, setModalError] = useState('')
  const [todoText, setTodoText] = useState('')
  const [todoRecurrence, setTodoRecurrence] = useState('')
  const [todoAction, setTodoAction] = useState('')
  const draggedTodoId = useRef(null)

  const eventMap = useMemo(() => toEventMap(events), [events])
  const displayedTodos = useMemo(() => sortTodosForDisplay(todos), [todos])
  const todayKey = localDateKey(new Date())

  const loadWorkspace = useCallback(async () => {
    setIsLoading(true)
    setActionError('')
    try {
      const [loadedEvents, loadedTodos] = await Promise.all([calendarRequests.events(), todoRequests.list()])
      setEvents(sortEvents(loadedEvents))
      setTodos(loadedTodos)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to load your calendar workspace.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadWorkspace])

  const changeMonth = (offset) => {
    const next = new Date(calendarYear, calendarMonth + offset, 1)
    const nextYear = Math.min(YEARS[YEARS.length - 1], Math.max(YEARS[0], next.getFullYear()))
    const nextMonth = nextYear !== next.getFullYear() ? (nextYear === YEARS[0] ? 0 : 11) : next.getMonth()
    setCalendarYear(nextYear)
    setCalendarMonth(nextMonth)
  }

  const jumpToToday = () => {
    const now = new Date()
    const nextYear = YEARS.includes(now.getFullYear()) ? now.getFullYear() : YEARS[0]
    setCalendarYear(nextYear)
    setCalendarMonth(nextYear === now.getFullYear() ? now.getMonth() : 0)
  }

  const openDay = (dateKey) => {
    setModalError('')
    setEventForm({ subject: '', time: '', room: '', isExam: false, recurring: false, repeatWeeks: '8' })
    setEventModalDate(dateKey)
  }

  const closeDay = () => {
    if (!eventAction) setEventModalDate('')
  }

  const handleEventCreate = async (event) => {
    event.preventDefault()
    const subject = eventForm.subject.trim()
    if (!subject) {
      setModalError('Enter a subject or event name.')
      return
    }

    setModalError('')
    setEventAction('create')
    try {
      const createdEvents = await calendarRequests.createEvents({
        date: eventModalDate,
        subject,
        time: eventForm.time,
        room: eventForm.room.trim(),
        isExam: eventForm.isExam,
        recurring: eventForm.recurring,
        repeatWeeks: Number(eventForm.repeatWeeks),
      })
      setEvents((current) => sortEvents([...current, ...createdEvents]))
      setEventForm({ subject: '', time: '', room: '', isExam: false, recurring: false, repeatWeeks: '8' })
    } catch (error) {
      setModalError(getErrorMessage(error, 'Unable to add this event.'))
    } finally {
      setEventAction('')
    }
  }

  const handleEventDelete = async (eventId) => {
    setModalError('')
    setEventAction(eventId)
    try {
      await calendarRequests.deleteEvent(eventId)
      setEvents((current) => current.filter((event) => event._id !== eventId))
    } catch (error) {
      setModalError(getErrorMessage(error, 'Unable to delete this event.'))
    } finally {
      setEventAction('')
    }
  }

  const replaceTodo = (updatedTodo) => setTodos((current) => current.map((todo) => (todo._id === updatedTodo._id ? updatedTodo : todo)))

  const handleTodoCreate = async (event) => {
    event.preventDefault()
    const text = todoText.trim()
    if (!text) {
      setActionError('Enter a task before adding it.')
      return
    }

    setActionError('')
    setTodoAction('create')
    try {
      const todo = await todoRequests.create({ text, recurrence: todoRecurrence })
      setTodos((current) => [...current, todo])
      setTodoText('')
      setTodoRecurrence('')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to add this task.'))
    } finally {
      setTodoAction('')
    }
  }

  const handleTodoUpdate = async (todo, changes) => {
    setActionError('')
    setTodoAction(todo._id)
    try {
      const updatedTodo = await todoRequests.update(todo._id, changes)
      replaceTodo(updatedTodo)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to update this task.'))
    } finally {
      setTodoAction('')
    }
  }

  const handleTodoDelete = async (todoId) => {
    setActionError('')
    setTodoAction(todoId)
    try {
      await todoRequests.remove(todoId)
      setTodos((current) => current.filter((todo) => todo._id !== todoId))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to delete this task.'))
    } finally {
      setTodoAction('')
    }
  }

  const handleTodoDrop = async (targetId) => {
    const sourceId = draggedTodoId.current
    draggedTodoId.current = null
    if (!sourceId || sourceId === targetId || todoAction) return

    const sourceIndex = displayedTodos.findIndex((todo) => todo._id === sourceId)
    const targetIndex = displayedTodos.findIndex((todo) => todo._id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reordered = [...displayedTodos]
    const [movedTodo] = reordered.splice(sourceIndex, 1)
    reordered.splice(targetIndex, 0, movedTodo)
    const optimistic = reordered.map((todo, index) => ({ ...todo, order: index + 1 }))
    setTodos(optimistic)
    setTodoAction('reorder')
    setActionError('')
    try {
      const savedTodos = await todoRequests.reorder(reordered.map((todo) => todo._id))
      setTodos(savedTodos)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to reorder tasks.'))
      void loadWorkspace()
    } finally {
      setTodoAction('')
    }
  }

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay()
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
    const blanks = Array.from({ length: firstWeekday }, (_, index) => ({ type: 'blank', key: `blank-${index}` }))
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1
      const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { type: 'day', day, dateKey, events: eventMap[dateKey] || [] }
    })
    return [...blanks, ...days]
  }, [calendarMonth, calendarYear, eventMap])

  const agendaDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() + index)
    const dateKey = localDateKey(date)
    return { date, dateKey, events: eventMap[dateKey] || [], isToday: index === 0 }
  }), [eventMap])

  const currentDayEvents = eventMap[eventModalDate] || []

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1180px] px-5 pb-24 pt-5">
        <WorkspaceHeader activeTab="Calendar" />
        <div className="mb-[14px] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="m-0 text-[24px] font-bold">Calendar</h1>
          <div className="flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.045] p-1">
            {['month', 'agenda'].map((mode) => <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition ${viewMode === mode ? 'bg-cyan-400/14 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}>{mode}</button>)}
          </div>
        </div>

        {actionError && <div role="alert" className="mb-[14px] flex items-center justify-between gap-3 rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} className="font-semibold hover:text-white">Dismiss</button></div>}

        <section className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.6)] sm:p-5">
          <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-full border border-white/[0.09] bg-white/[0.045] p-1">
              {YEARS.map((year) => <button key={year} type="button" onClick={() => { setCalendarYear(year); setCalendarMonth(0) }} className={`rounded-full px-3.5 py-[7px] text-[12.5px] font-semibold transition ${calendarYear === year ? 'bg-cyan-400/14 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}>{year}</button>)}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="grid h-[34px] w-[34px] place-items-center rounded-[10px] px-2 text-xl leading-none text-slate-400 transition hover:bg-white/[0.045] hover:text-slate-100">‹</button>
              <span className="min-w-[130px] text-center font-display text-[13.5px] font-bold">{monthLabel(calendarYear, calendarMonth)}</span>
              <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="grid h-[34px] w-[34px] place-items-center rounded-[10px] px-2 text-xl leading-none text-slate-400 transition hover:bg-white/[0.045] hover:text-slate-100">›</button>
              <button type="button" onClick={jumpToToday} className="rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-2.5 py-1.5 text-[12px] font-semibold text-slate-100 transition hover:border-violet-400/35 hover:bg-white/[0.075]">Today</button>
            </div>
          </div>

          {isLoading ? <div className="grid min-h-64 place-items-center text-sm text-slate-500">Loading calendar…</div> : viewMode === 'month' ? <div className="mt-1.5 grid grid-cols-7 gap-[5px]">
            {WEEKDAY_LABELS.map((weekday) => <div key={weekday} className="py-1 text-center text-[11px] font-bold uppercase tracking-[0.05em] text-slate-400">{weekday}</div>)}
            {calendarCells.map((cell) => cell.type === 'blank' ? <div key={cell.key} className="min-h-[74px] rounded-[10px] max-[640px]:min-h-[52px]" /> : <button key={cell.dateKey} type="button" onClick={() => openDay(cell.dateKey)} className={`flex min-h-[74px] flex-col gap-[3px] rounded-[10px] border p-[6px_7px] text-left transition hover:border-violet-400/35 hover:bg-white/[0.075] max-[640px]:min-h-[52px] max-[640px]:p-[4px_5px] ${cell.dateKey === todayKey ? 'border-cyan-400 shadow-[inset_0_0_0_1px_rgb(196_181_253)]' : 'border-white/[0.09] bg-white/[0.03]'}`}>
              <span className={`text-[12px] font-bold ${cell.dateKey === todayKey ? 'text-cyan-400' : 'text-slate-100'}`}>{cell.day}</span>
              {cell.events.slice(0, 2).map((calendarEvent) => <span key={calendarEvent._id} className={`overflow-hidden text-ellipsis whitespace-nowrap rounded-[5px] bg-cyan-400/14 px-[5px] py-0.5 text-[9.5px] font-semibold leading-[1.3] text-cyan-400 ${cell.dateKey === todayKey ? 'max-[640px]:block' : 'max-[640px]:hidden'}`}>{calendarEvent.time ? `${calendarEvent.time} ` : ''}{calendarEvent.subject}</span>)}
              {cell.events.length > 2 && <span className="text-[9.5px] text-slate-500">+{cell.events.length - 2} more</span>}
            </button>)}
          </div> : <div className="mt-2 flex flex-col gap-2">
            {agendaDays.map((day) => <div key={day.dateKey} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 border-b border-dashed border-white/[0.09] py-2.5 last:border-b-0">
              <span className={`font-display text-[12px] font-bold ${day.isToday ? 'text-cyan-400' : 'text-slate-400'}`}>{day.isToday ? 'Today' : formatAgendaDate(day.date)}</span>
              <div className="flex min-w-0 flex-col gap-1">{day.events.length ? day.events.map((calendarEvent) => <button key={calendarEvent._id} type="button" onClick={() => openDay(day.dateKey)} className="rounded-lg border border-white/[0.09] bg-white/[0.045] px-2 py-1 text-left text-[13px] text-slate-200 transition hover:border-violet-400/35">{calendarEvent.time ? `${calendarEvent.time} · ` : ''}{calendarEvent.subject}{calendarEvent.isExam ? ' · exam' : ''}{calendarEvent.room ? ` · ${calendarEvent.room}` : ''}</button>) : <span className="py-1 text-[13px] text-slate-500">Nothing scheduled</span>}</div>
            </div>)}
          </div>}
        </section>

        <div className="mb-2.5 mt-[22px] flex items-center gap-2 text-[13.5px] font-bold"><span className="h-4 w-[3px] rounded-full bg-violet-400 shadow-[0_0_8px_rgb(196_181_253)]" />To-Do List</div>
        <section className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] px-5 py-2 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.6)]">
          <form onSubmit={handleTodoCreate} className="flex gap-2 pt-0 sm:items-center">
            <label className="sr-only" htmlFor="todo-input">Add a task</label>
            <input id="todo-input" value={todoText} onChange={(event) => setTodoText(event.target.value)} placeholder="Add a task..." spellCheck="true" className="min-w-0 flex-1 rounded-lg border border-white/[0.09] bg-white/[0.03] px-2.5 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/45" />
            <label className="sr-only" htmlFor="todo-recurrence">Repeat task</label>
            <select id="todo-recurrence" value={todoRecurrence} onChange={(event) => setTodoRecurrence(event.target.value)} title="Repeat" className="max-w-[120px] rounded-lg border border-white/[0.09] bg-slate-900 px-2 py-2 text-[12px] text-slate-200 outline-none focus:border-violet-400/45">
              <option value="">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
            <button type="submit" disabled={todoAction === 'create'} className="rounded-[10px] border border-cyan-400 bg-cyan-400 px-2.5 py-1.5 text-[12px] font-bold text-[#04121a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{todoAction === 'create' ? 'Adding…' : 'Add'}</button>
          </form>

          <div className="mt-3">
            {!isLoading && !displayedTodos.length ? <p className="py-2.5 text-sm text-slate-500">Nothing on your list yet.</p> : displayedTodos.map((todo) => <div key={todo._id} draggable={!todoAction} onDragStart={() => { draggedTodoId.current = todo._id }} onDragEnd={() => { draggedTodoId.current = null }} onDragOver={(event) => event.preventDefault()} onDrop={() => void handleTodoDrop(todo._id)} className={`group flex items-center gap-3 border-b border-white/[0.06] px-1.5 py-[11px] transition last:border-b-0 ${todo.completed ? 'opacity-75' : ''}`}>
              <span aria-hidden="true" title="Drag to reorder" className="cursor-grab select-none px-1 text-xs text-slate-600 active:cursor-grabbing">⋮⋮</span>
              <button type="button" aria-label={todo.completed ? `Mark ${todo.text} incomplete` : `Mark ${todo.text} complete`} disabled={todoAction === todo._id} onClick={() => void handleTodoUpdate(todo, { completed: !todo.completed })} className={`grid h-[21px] w-[21px] shrink-0 place-items-center rounded-full border-[1.6px] transition hover:scale-105 disabled:cursor-not-allowed ${todo.completed ? 'border-violet-400 bg-violet-400 text-white' : 'border-violet-400 text-transparent hover:bg-violet-400/14'}`}><CheckIcon /></button>
              <button type="button" title={`Priority: ${todo.priority} (click to change)`} disabled={todoAction === todo._id} onClick={() => void handleTodoUpdate(todo, { priority: NEXT_PRIORITY[todo.priority] })} style={{ backgroundColor: PRIORITY_COLOR[todo.priority] }} className="h-2 w-2 shrink-0 rounded-full transition hover:scale-140 disabled:cursor-not-allowed" />
              <span className={`min-w-0 flex-1 text-[14px] ${todo.completed ? 'text-slate-500 line-through decoration-slate-500' : 'text-slate-100'}`}>{todo.text}{todo.recurrence && <span title={`Repeats ${todo.recurrence}`} className="ml-1 text-[10px] text-violet-400">↻ {todo.recurrence}</span>}</span>
              <button type="button" aria-label={`Delete ${todo.text}`} disabled={todoAction === todo._id} onClick={() => void handleTodoDelete(todo._id)} className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-500 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-200 group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed"><TrashIcon /></button>
            </div>)}
          </div>
        </section>
      </div>

      {eventModalDate && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDay() }} className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="day-modal-title" className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-white/[0.11] bg-slate-900 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-start justify-between gap-4"><h2 id="day-modal-title" className="m-0 text-xl font-bold">{formatLongDate(eventModalDate)}</h2><button type="button" onClick={closeDay} disabled={Boolean(eventAction)} aria-label="Close" className="rounded-lg px-2 py-1 text-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed">×</button></div>
          <div className="mb-3 space-y-1.5">{currentDayEvents.length ? currentDayEvents.map((calendarEvent) => <div key={calendarEvent._id} className="flex items-center justify-between gap-3 rounded-[10px] border border-white/[0.09] bg-white/[0.03] px-3 py-2"><p className="min-w-0 text-[13px] text-slate-300">{calendarEvent.time} <strong className="text-slate-100">{calendarEvent.subject}</strong>{calendarEvent.room ? ` · ${calendarEvent.room}` : ''}{calendarEvent.isExam && <span className="ml-1.5 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">EXAM</span>}{calendarEvent.recurring && <span className="ml-1.5 rounded-full bg-cyan-400/14 px-2 py-0.5 text-[10px] font-bold text-cyan-400">weekly</span>}</p><button type="button" aria-label={`Delete ${calendarEvent.subject}`} disabled={Boolean(eventAction)} onClick={() => void handleEventDelete(calendarEvent._id)} className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed"><TrashIcon /></button></div>) : <p className="rounded-[10px] border border-dashed border-white/[0.09] px-3 py-3 text-sm text-slate-500">No events yet on this date.</p>}</div>
          {modalError && <p role="alert" className="mb-3 rounded-lg border border-rose-400/35 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{modalError}</p>}
          <form onSubmit={handleEventCreate} className="space-y-3">
            <div><label htmlFor="event-subject" className="mb-1 block text-[12px] font-semibold text-slate-400">Subject / Event</label><input id="event-subject" value={eventForm.subject} onChange={(event) => setEventForm((current) => ({ ...current, subject: event.target.value }))} placeholder="e.g. Data Structures class" autoFocus className="w-full rounded-[10px] border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50" /></div>
            <div className="grid gap-2 sm:grid-cols-2"><div><label htmlFor="event-time" className="mb-1 block text-[12px] font-semibold text-slate-400">Time (optional)</label><input id="event-time" type="time" value={eventForm.time} onChange={(event) => setEventForm((current) => ({ ...current, time: event.target.value }))} className="w-full rounded-[10px] border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-[13px] text-slate-100 outline-none focus:border-cyan-400/50" /></div><div><label htmlFor="event-room" className="mb-1 block text-[12px] font-semibold text-slate-400">Room (optional)</label><input id="event-room" value={eventForm.room} onChange={(event) => setEventForm((current) => ({ ...current, room: event.target.value }))} placeholder="e.g. Lab 3" className="w-full rounded-[10px] border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-[13px] text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50" /></div></div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-400"><input type="checkbox" checked={eventForm.isExam} onChange={(event) => setEventForm((current) => ({ ...current, isExam: event.target.checked }))} className="h-4 w-4 accent-cyan-400" />This is an exam</label>
            <div className="flex flex-wrap items-center gap-2.5"><label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-400"><input type="checkbox" checked={eventForm.recurring} onChange={(event) => setEventForm((current) => ({ ...current, recurring: event.target.checked }))} className="h-4 w-4 accent-cyan-400" />Repeat weekly</label>{eventForm.recurring && <select value={eventForm.repeatWeeks} onChange={(event) => setEventForm((current) => ({ ...current, repeatWeeks: event.target.value }))} className="rounded-lg border border-white/[0.09] bg-white/[0.03] px-2 py-1 text-[12px] text-slate-200 outline-none focus:border-cyan-400/50"><option value="4">for 4 weeks</option><option value="8">for 8 weeks</option><option value="12">for 12 weeks</option><option value="16">for 16 weeks</option></select>}</div>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={closeDay} disabled={Boolean(eventAction)} className="rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-3 py-2 text-[13px] font-semibold text-slate-200 transition hover:bg-white/[0.075] disabled:cursor-not-allowed">Close</button><button type="submit" disabled={Boolean(eventAction)} className="rounded-[10px] border border-cyan-400 bg-cyan-400 px-3 py-2 text-[13px] font-bold text-[#04121a] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{eventAction === 'create' ? 'Adding…' : 'Add Event'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}
