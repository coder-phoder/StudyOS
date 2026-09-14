import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'
import { useAuth } from '../../Context/AuthContext'

const semesterApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const COLORS = [
  { value: '#a78bfa', name: 'Violet', border: 'border-violet-400', swatch: 'bg-violet-400' },
  { value: '#ffb86b', name: 'Amber', border: 'border-amber-300', swatch: 'bg-amber-300' },
  { value: '#fb923c', name: 'Orange', border: 'border-orange-400', swatch: 'bg-orange-400' },
  { value: '#4ade80', name: 'Green', border: 'border-emerald-400', swatch: 'bg-emerald-400' },
  { value: '#c084fc', name: 'Purple', border: 'border-purple-400', swatch: 'bg-purple-400' },
  { value: '#f5f0e6', name: 'Ivory', border: 'border-slate-200', swatch: 'bg-slate-200' },
]

const getResponseData = (response, fallbackMessage) => {
  if (!response.data?.success) throw new Error(response.data?.message || fallbackMessage)
  return response.data.data || {}
}

const semesterRequests = {
  list: async () => (await getResponseData(await semesterApi.get('/api/semesters'), 'Unable to load semesters')).semesters || [],
  create: async (payload) => (await getResponseData(await semesterApi.post('/api/semesters', payload), 'Unable to create semester')).semester,
  update: async (semesterId, payload) => (await getResponseData(await semesterApi.put(`/api/semesters/${semesterId}`, payload), 'Unable to update semester')).semester,
  remove: async (semesterId) => getResponseData(await semesterApi.delete(`/api/semesters/${semesterId}`), 'Unable to delete semester'),
  createSubject: async (semesterId, payload) => (await getResponseData(await semesterApi.post(`/api/semesters/${semesterId}/subjects`, payload), 'Unable to create subject')).semester,
  updateSubject: async (semesterId, subjectId, payload) => (await getResponseData(await semesterApi.put(`/api/semesters/${semesterId}/subjects/${subjectId}`, payload), 'Unable to update subject')).semester,
  removeSubject: async (semesterId, subjectId) => (await getResponseData(await semesterApi.delete(`/api/semesters/${semesterId}/subjects/${subjectId}`), 'Unable to delete subject')).semester,
  createTopic: async (semesterId, subjectId, payload) => (await getResponseData(await semesterApi.post(`/api/semesters/${semesterId}/subjects/${subjectId}/topics`, payload), 'Unable to create topic')).semester,
  updateTopic: async (semesterId, subjectId, topicId, payload) => (await getResponseData(await semesterApi.put(`/api/semesters/${semesterId}/subjects/${subjectId}/topics/${topicId}`, payload), 'Unable to update topic')).semester,
  removeTopic: async (semesterId, subjectId, topicId) => (await getResponseData(await semesterApi.delete(`/api/semesters/${semesterId}/subjects/${subjectId}/topics/${topicId}`), 'Unable to delete topic')).semester,
}

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const initialsFor = (name) => (name || 'StudyOS')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

const colorFor = (value) => COLORS.find((color) => color.value === String(value || '').toLowerCase()) || COLORS[0]

const toInputDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const formatDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

const dueTone = (value) => {
  if (!value) return 'border-slate-700 bg-slate-800/70 text-slate-300'
  const due = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return 'border-rose-400/40 bg-rose-400/10 text-rose-200'
  if (days <= 3) return 'border-amber-400/40 bg-amber-400/10 text-amber-100'
  return 'border-slate-700 bg-slate-800/70 text-slate-300'
}

const subjectProgress = (subject) => {
  const topics = subject.topics || []
  const completed = topics.filter((topic) => topic.completed).length
  return { completed, total: topics.length, percent: topics.length ? Math.round((completed / topics.length) * 100) : 0 }
}

const semesterProgress = (semester) => {
  const topics = (semester.subjects || []).flatMap((subject) => subject.topics || [])
  const completed = topics.filter((topic) => topic.completed).length
  return { completed, total: topics.length, percent: topics.length ? Math.round((completed / topics.length) * 100) : 0 }
}

const calculateGpa = (semesters) => {
  let weightedTotal = 0
  let totalCredits = 0
  const semesterRows = []

  semesters.forEach((semester) => {
    let semesterWeightedTotal = 0
    let semesterCredits = 0
    const subjects = semester.subjects || []
    subjects.forEach((subject) => {
      if (subject.grade === null || subject.grade === undefined || subject.grade === '') return
      const rawGrade = Number(subject.grade)
      if (!Number.isFinite(rawGrade)) return
      const normalizedGrade = rawGrade > 10 ? rawGrade / 10 : rawGrade
      const credits = Number(subject.credits) > 0 ? Number(subject.credits) : 1
      semesterWeightedTotal += normalizedGrade * credits
      semesterCredits += credits
      weightedTotal += normalizedGrade * credits
      totalCredits += credits
    })
    if (semesterCredits) {
      semesterRows.push({
        id: semester._id,
        name: semester.name,
        gpa: Math.round((semesterWeightedTotal / semesterCredits) * 100) / 100,
        credits: semesterCredits,
      })
    }
  })

  return {
    semesterRows,
    overall: totalCredits ? Math.round((weightedTotal / totalCredits) * 100) / 100 : null,
  }
}

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]))

export default function SemestersPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [semesters, setSemesters] = useState([])
  const [openSemesters, setOpenSemesters] = useState(new Set())
  const [openSubjects, setOpenSubjects] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [modalError, setModalError] = useState('')
  const [modal, setModal] = useState(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const gpa = useMemo(() => calculateGpa(semesters), [semesters])
  const allProgress = useMemo(() => {
    const topics = semesters.flatMap((semester) => (semester.subjects || []).flatMap((subject) => subject.topics || []))
    const completed = topics.filter((topic) => topic.completed).length
    return { completed, total: topics.length }
  }, [semesters])

  const replaceSemester = useCallback((updatedSemester) => {
    setSemesters((current) => current.map((semester) => (semester._id === updatedSemester._id ? updatedSemester : semester)))
  }, [])

  const execute = useCallback(async (actionId, operation, fallbackMessage, useModalError = false) => {
    setActionError('')
    setModalError('')
    setPendingAction(actionId)
    try {
      return await operation()
    } catch (error) {
      const message = getErrorMessage(error, fallbackMessage)
      setActionError(message)
      if (useModalError) setModalError(message)
      return null
    } finally {
      setPendingAction('')
    }
  }, [])

  const loadSemesters = useCallback(async () => {
    setIsLoading(true)
    setActionError('')
    try {
      const loadedSemesters = await semesterRequests.list()
      setSemesters(loadedSemesters)
      setOpenSemesters(new Set(loadedSemesters.map((semester) => semester._id)))
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to load your semesters.'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadSemesters()
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [loadSemesters])

  const toggleSemester = (semesterId) => {
    setOpenSemesters((current) => {
      const next = new Set(current)
      if (next.has(semesterId)) next.delete(semesterId)
      else next.add(semesterId)
      return next
    })
  }

  const toggleSubject = (subjectId) => {
    setOpenSubjects((current) => {
      const next = new Set(current)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

  const openModal = (nextModal) => {
    setActionError('')
    setModalError('')
    setModal(nextModal)
  }

  const closeModal = () => {
    if (!pendingAction) setModal(null)
  }

  const handleLogout = async () => {
    setActionError('')
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to log out.'))
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleSubjectCreate = async (event, semesterId) => {
    event.preventDefault()
    const form = event.currentTarget
    const name = new FormData(form).get('subjectName')?.toString().trim()
    if (!name) {
      setActionError('Enter a subject name before adding it.')
      return
    }
    const semester = await execute(`subject-create-${semesterId}`, () => semesterRequests.createSubject(semesterId, { name }), 'Unable to create subject.')
    if (semester) {
      replaceSemester(semester)
      setOpenSemesters((current) => new Set(current).add(semesterId))
      form.reset()
    }
  }

  const handleTopicCreate = async (event, semesterId, subjectId) => {
    event.preventDefault()
    const form = event.currentTarget
    const name = new FormData(form).get('topicName')?.toString().trim()
    if (!name) {
      setActionError('Enter a topic name before adding it.')
      return
    }
    const semester = await execute(`topic-create-${subjectId}`, () => semesterRequests.createTopic(semesterId, subjectId, { name }), 'Unable to create topic.')
    if (semester) {
      replaceSemester(semester)
      setOpenSemesters((current) => new Set(current).add(semesterId))
      setOpenSubjects((current) => new Set(current).add(subjectId))
      form.reset()
    }
  }

  const handleTopicToggle = async (semesterId, subjectId, topic) => {
    const semester = await execute(`topic-toggle-${topic._id}`, () => semesterRequests.updateTopic(semesterId, subjectId, topic._id, { completed: !topic.completed }), 'Unable to update topic progress.')
    if (semester) replaceSemester(semester)
  }

  const handleModalSubmit = async (values) => {
    if (!modal) return
    const modalAction = `modal-${modal.type}`
    let result = null

    if (modal.type === 'semester-create') {
      result = await execute(modalAction, () => semesterRequests.create(values), 'Unable to create semester.', true)
      if (result) {
        setSemesters((current) => [result, ...current])
        setOpenSemesters((current) => new Set(current).add(result._id))
      }
    }

    if (modal.type === 'semester-edit') {
      result = await execute(modalAction, () => semesterRequests.update(modal.semester._id, values), 'Unable to update semester.', true)
      if (result) replaceSemester(result)
    }

    if (modal.type === 'subject-edit') {
      const payload = { ...values, grade: values.grade === '' ? null : values.grade, credits: values.credits === '' ? null : values.credits }
      result = await execute(modalAction, () => semesterRequests.updateSubject(modal.semester._id, modal.subject._id, payload), 'Unable to update subject.', true)
      if (result) replaceSemester(result)
    }

    if (modal.type === 'topic-edit') {
      const payload = { ...values, dueDate: values.dueDate || null }
      result = await execute(modalAction, () => semesterRequests.updateTopic(modal.semester._id, modal.subject._id, modal.topic._id, payload), 'Unable to update topic.', true)
      if (result) replaceSemester(result)
    }

    if (modal.type === 'semester-delete') {
      result = await execute(modalAction, () => semesterRequests.remove(modal.semester._id), 'Unable to delete semester.', true)
      if (result) {
        setSemesters((current) => current.filter((semester) => semester._id !== modal.semester._id))
        setOpenSemesters((current) => {
          const next = new Set(current)
          next.delete(modal.semester._id)
          return next
        })
      }
    }

    if (modal.type === 'subject-delete') {
      result = await execute(modalAction, () => semesterRequests.removeSubject(modal.semester._id, modal.subject._id), 'Unable to delete subject.', true)
      if (result) replaceSemester(result)
    }

    if (modal.type === 'topic-delete') {
      result = await execute(modalAction, () => semesterRequests.removeTopic(modal.semester._id, modal.subject._id, modal.topic._id), 'Unable to delete topic.', true)
      if (result) replaceSemester(result)
    }

    if (result) setModal(null)
  }

  const exportReport = () => {
    const totalProgress = allProgress.total ? Math.round((allProgress.completed / allProgress.total) * 100) : 0
    const semesterSections = semesters.map((semester) => {
      const subjects = (semester.subjects || []).map((subject) => {
        const progress = subjectProgress(subject)
        const grade = subject.grade === null || subject.grade === undefined ? '' : ` · grade ${escapeHtml(subject.grade)}`
        const credits = subject.credits ? ` · ${escapeHtml(subject.credits)} cr` : ''
        return `<li>${escapeHtml(subject.name)} — ${progress.completed}/${progress.total} topics${grade}${credits}</li>`
      }).join('')
      return `<h3>${escapeHtml(semester.name)}</h3><ul>${subjects || '<li>No subjects</li>'}</ul>`
    }).join('') || '<p>No semesters added yet.</p>'
    const popup = window.open('', '_blank')
    if (!popup) {
      setActionError('Your browser blocked the report window. Allow pop-ups and try again.')
      return
    }
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>StudyOS progress report</title><style>body{font-family:Inter,Arial,sans-serif;max-width:720px;margin:40px auto;color:#111;line-height:1.5;padding:0 20px}h1{font-size:25px}h2{font-size:17px;margin-top:28px}.muted{color:#666}</style></head><body><h1>StudyOS Progress Report</h1><p class="muted">${new Date().toLocaleString()}</p><h2>Snapshot</h2><ul><li>Topics: ${allProgress.completed}/${allProgress.total} complete (${totalProgress}%)</li><li>Overall GPA: ${gpa.overall !== null ? `${gpa.overall}/10` : '—'}</li><li>Semesters: ${semesters.length}</li></ul><h2>Semesters</h2>${semesterSections}<script>window.onload=()=>window.print()</script></body></html>`)
    popup.document.close()
  }

  const isBusy = Boolean(pendingAction) || isLoggingOut

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <AppLogo light />
            <nav aria-label="User navigation" className="flex items-center gap-1 text-sm font-semibold">
              <Link to="/user/home" className="rounded-lg px-3 py-2 text-slate-400 transition hover:text-white">Profile</Link>
              <Link to="/user/semesters" className="rounded-lg bg-violet-400/15 px-3 py-2 text-violet-200">Semesters</Link>
              <Link to="/user/notes" className="rounded-lg px-3 py-2 text-slate-400 transition hover:text-white">My Notes</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span title={user?.username} className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-xs font-black text-slate-950">{initialsFor(user?.username)}</span>
            <button type="button" onClick={() => void handleLogout()} disabled={isBusy} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60">{isLoggingOut ? 'Logging out…' : 'Log out'}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-400">Your study plan</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Semesters</h1>
            <p className="mt-2 text-sm text-slate-400">Organize subjects, track every topic, and keep grades in one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportReport} disabled={isBusy} className="rounded-xl border border-slate-700 px-3.5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60">↓ Report</button>
            <button type="button" onClick={() => openModal({ type: 'semester-create' })} disabled={isBusy} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">+ Add Semester</button>
          </div>
        </div>

        {actionError && <div role="alert" className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} className="shrink-0 font-semibold text-rose-200 hover:text-white">Dismiss</button></div>}

        <GpaSummary gpa={gpa} />

        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-12 text-center text-sm text-slate-400">Loading your semesters…</div>
        ) : semesters.length === 0 ? (
          <section className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/55 px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-200">No semesters yet.</p>
            <p className="mt-2 text-sm text-slate-400">Add a semester, then create subjects and topics to begin tracking progress.</p>
            <button type="button" onClick={() => openModal({ type: 'semester-create' })} disabled={isBusy} className="mt-5 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">Create your first semester</button>
          </section>
        ) : (
          <section aria-label="Semesters" className="mt-4 space-y-3">
            {semesters.map((semester) => <SemesterCard key={semester._id} semester={semester} isOpen={openSemesters.has(semester._id)} openSubjects={openSubjects} isBusy={isBusy} onToggleSemester={toggleSemester} onToggleSubject={toggleSubject} onCreateSubject={handleSubjectCreate} onCreateTopic={handleTopicCreate} onToggleTopic={handleTopicToggle} onOpenModal={openModal} />)}
          </section>
        )}
      </div>

      {modal && <SemesterModal key={`${modal.type}-${modal.semester?._id || ''}-${modal.subject?._id || ''}-${modal.topic?._id || ''}`} modal={modal} semesterCount={semesters.length} error={modalError} isSubmitting={Boolean(pendingAction)} onClose={closeModal} onSubmit={handleModalSubmit} />}
    </main>
  )
}

function GpaSummary({ gpa }) {
  return (
    <section className="mt-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-slate-950/20">
      {gpa.semesterRows.length === 0 && gpa.overall === null ? (
        <p className="text-sm text-slate-400">Add grades and credits to subjects to see your GPA summary here.</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-bold">GPA Summary</h2>
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-200">{gpa.overall !== null ? `Overall ${gpa.overall}/10` : '—'}</span>
          </div>
          <div className="mt-3 divide-y divide-slate-800">
            {gpa.semesterRows.map((row) => <div key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="truncate font-medium text-slate-200">{row.name}</span><span className="shrink-0 text-slate-400">{row.gpa}/10 · {row.credits} cr</span></div>)}
          </div>
        </>
      )}
    </section>
  )
}

function SemesterCard({ semester, isOpen, openSubjects, isBusy, onToggleSemester, onToggleSubject, onCreateSubject, onCreateTopic, onToggleTopic, onOpenModal }) {
  const progress = semesterProgress(semester)
  const color = colorFor(semester.color)

  return (
    <article className={`overflow-hidden rounded-2xl border border-slate-800 border-l-4 ${color.border} bg-slate-900/80 shadow-xl shadow-slate-950/20`}>
      <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <button type="button" onClick={() => onToggleSemester(semester._id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900">
          <span aria-hidden="true" className={`text-sm text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
          <span className="truncate text-base font-bold text-slate-100">{semester.name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300">{progress.percent}%</span>
          <button type="button" onClick={() => onOpenModal({ type: 'semester-edit', semester })} disabled={isBusy} title={`Edit ${semester.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">✎<span className="sr-only">Edit semester</span></button>
          <button type="button" onClick={() => onOpenModal({ type: 'semester-delete', semester })} disabled={isBusy} title={`Delete ${semester.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50">🗑<span className="sr-only">Delete semester</span></button>
        </div>
      </div>
      <div className="mx-4 mb-4 h-1.5 overflow-hidden rounded-full bg-slate-800 sm:mx-5"><div className="h-full rounded-full bg-linear-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${progress.percent}%` }} /></div>

      {isOpen && <div className="border-t border-slate-800 px-4 py-4 sm:px-5">
        <div className="space-y-2.5">
          {(semester.subjects || []).map((subject) => <SubjectCard key={subject._id} semester={semester} subject={subject} isOpen={openSubjects.has(subject._id)} isBusy={isBusy} onToggleSubject={onToggleSubject} onCreateTopic={onCreateTopic} onToggleTopic={onToggleTopic} onOpenModal={onOpenModal} />)}
        </div>
        <form onSubmit={(event) => void onCreateSubject(event, semester._id)} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor={`subject-${semester._id}`}>Add subject</label>
          <input id={`subject-${semester._id}`} name="subjectName" maxLength="160" disabled={isBusy} placeholder="Add subject..." className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/55 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" />
          <button type="submit" disabled={isBusy} className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">{isBusy ? 'Adding…' : 'Add'}</button>
        </form>
      </div>}
    </article>
  )
}

function SubjectCard({ semester, subject, isOpen, isBusy, onToggleSubject, onCreateTopic, onToggleTopic, onOpenModal }) {
  const progress = subjectProgress(subject)

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onToggleSubject(subject._id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-cyan-300">
          <span aria-hidden="true" className={`text-xs text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
          <span className="truncate text-sm font-semibold text-slate-200">{subject.name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          {subject.credits !== null && subject.credits !== undefined && <span className="hidden rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-400 sm:inline">{subject.credits} cr</span>}
          {subject.grade !== null && subject.grade !== undefined && <span className="hidden rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-100 sm:inline">Grade {subject.grade}</span>}
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-400">{progress.completed}/{progress.total}</span>
          <button type="button" onClick={() => onOpenModal({ type: 'subject-edit', semester, subject })} disabled={isBusy} title={`Edit ${subject.name}`} className="grid h-7 w-7 place-items-center rounded-md text-xs text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">✎<span className="sr-only">Edit subject</span></button>
          <button type="button" onClick={() => onOpenModal({ type: 'subject-delete', semester, subject })} disabled={isBusy} title={`Delete ${subject.name}`} className="grid h-7 w-7 place-items-center rounded-md text-xs text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50">🗑<span className="sr-only">Delete subject</span></button>
        </div>
      </div>

      {isOpen && <div className="mt-3 border-t border-slate-800 pt-2.5">
        <div className="space-y-1">
          {(subject.topics || []).map((topic) => <TopicRow key={topic._id} semester={semester} subject={subject} topic={topic} isBusy={isBusy} onToggleTopic={onToggleTopic} onOpenModal={onOpenModal} />)}
        </div>
        <form onSubmit={(event) => void onCreateTopic(event, semester._id, subject._id)} className="mt-2.5 flex gap-2">
          <label className="sr-only" htmlFor={`topic-${subject._id}`}>Add topic</label>
          <input id={`topic-${subject._id}`} name="topicName" maxLength="160" disabled={isBusy} placeholder="Add topic..." className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" />
          <button type="submit" disabled={isBusy} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">{isBusy ? 'Adding…' : 'Add'}</button>
        </form>
      </div>}
    </section>
  )
}

function TopicRow({ semester, subject, topic, isBusy, onToggleTopic, onOpenModal }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-slate-800/65 ${topic.completed ? 'text-slate-500' : 'text-slate-200'}`}>
      <input type="checkbox" checked={Boolean(topic.completed)} disabled={isBusy} onChange={() => void onToggleTopic(semester._id, subject._id, topic)} aria-label={`Mark ${topic.name} as ${topic.completed ? 'incomplete' : 'complete'}`} className="h-4 w-4 shrink-0 accent-cyan-400 disabled:cursor-not-allowed" />
      <span className={`min-w-0 flex-1 break-words text-sm ${topic.completed ? 'line-through decoration-slate-500' : ''}`}>{topic.name}</span>
      {topic.dueDate && <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:inline ${dueTone(topic.dueDate)}`}>{formatDate(topic.dueDate)}</span>}
      <button type="button" onClick={() => onOpenModal({ type: 'topic-edit', semester, subject, topic })} disabled={isBusy} title={`Edit ${topic.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs text-slate-500 transition hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">✎<span className="sr-only">Edit topic</span></button>
      <button type="button" onClick={() => onOpenModal({ type: 'topic-delete', semester, subject, topic })} disabled={isBusy} title={`Delete ${topic.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-xs text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-50">×<span className="sr-only">Delete topic</span></button>
    </div>
  )
}

function SemesterModal({ modal, semesterCount, error, isSubmitting, onClose, onSubmit }) {
  const isDelete = modal.type.endsWith('-delete')
  const isSemester = modal.type.startsWith('semester')
  const isSubject = modal.type.startsWith('subject')
  const isTopic = modal.type.startsWith('topic')
  const title = modal.type === 'semester-create' ? 'New Semester' : modal.type === 'semester-edit' ? 'Edit Semester' : modal.type === 'subject-edit' ? 'Edit Subject' : modal.type === 'topic-edit' ? 'Edit Topic' : 'Are you sure?'
  const itemName = modal.semester?.name || modal.subject?.name || modal.topic?.name || ''
  const [values, setValues] = useState({
    name: modal.semester?.name || modal.subject?.name || modal.topic?.name || `Semester ${semesterCount + 1}`,
    color: modal.semester?.color || COLORS[semesterCount % COLORS.length].value,
    grade: modal.subject?.grade ?? '',
    credits: modal.subject?.credits ?? '',
    dueDate: toInputDate(modal.topic?.dueDate),
  })

  const updateValue = (field, value) => setValues((current) => ({ ...current, [field]: value }))
  const handleSubmit = (event) => {
    event.preventDefault()
    void onSubmit(values)
  }
  const deleteMessage = modal.type === 'semester-delete' ? `Delete “${itemName}” and all of its subjects and topics? This cannot be undone.` : modal.type === 'subject-delete' ? `Delete “${itemName}” and all of its topics? This cannot be undone.` : `Delete “${itemName}”? This cannot be undone.`

  return (
    <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="semester-modal-title" className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4">
          <h2 id="semester-modal-title" className="text-lg font-bold text-white">{title}</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} aria-label="Close modal" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed">×</button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}
        {isDelete ? (
          <form onSubmit={handleSubmit} className="mt-4">
            <p className="text-sm leading-6 text-slate-400">{deleteMessage}</p>
            <ModalActions isSubmitting={isSubmitting} isDelete onClose={onClose} />
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <Field label="Name" htmlFor="modal-name">
              <input id="modal-name" value={values.name} onChange={(event) => updateValue('name', event.target.value)} maxLength={isTopic ? 160 : 120} required disabled={isSubmitting} autoFocus className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" />
            </Field>
            {isSemester && <Field label="Color">
              <div className="flex flex-wrap gap-2" aria-label="Semester color">
                {COLORS.map((color) => <button key={color.value} type="button" aria-label={color.name} title={color.name} onClick={() => updateValue('color', color.value)} disabled={isSubmitting} className={`grid h-8 w-8 place-items-center rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed ${values.color === color.value ? 'border-white' : 'border-transparent hover:border-slate-500'}`}><span className={`h-5 w-5 rounded-full ${color.swatch}`} /></button>)}
              </div>
            </Field>}
            {isSubject && <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Grade (optional)" htmlFor="modal-grade"><input id="modal-grade" value={values.grade} onChange={(event) => updateValue('grade', event.target.value)} type="number" min="0" max="100" step="0.01" disabled={isSubmitting} placeholder="e.g. 9.2 or 85" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" /></Field>
              <Field label="Credits (optional)" htmlFor="modal-credits"><input id="modal-credits" value={values.credits} onChange={(event) => updateValue('credits', event.target.value)} type="number" min="0.5" max="100" step="0.5" disabled={isSubmitting} placeholder="e.g. 3" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" /></Field>
            </div>}
            {isSubject && <p className="-mt-2 text-xs leading-5 text-slate-500">Credits weight this grade in the overall average. A grade without credits counts as one credit.</p>}
            {isTopic && <Field label="Due date (optional)" htmlFor="modal-due-date"><input id="modal-due-date" value={values.dueDate} onChange={(event) => updateValue('dueDate', event.target.value)} type="date" disabled={isSubmitting} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-60" /></Field>}
            <ModalActions isSubmitting={isSubmitting} onClose={onClose} />
          </form>
        )}
      </section>
    </div>
  )
}

function Field({ label, htmlFor, children }) {
  return <div><label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-300">{label}</label>{children}</div>
}

function ModalActions({ isSubmitting, isDelete = false, onClose }) {
  return <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60">Cancel</button><button type="submit" disabled={isSubmitting} className={`rounded-xl px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${isDelete ? 'border border-rose-400/50 text-rose-100 hover:bg-rose-400/10' : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'}`}>{isSubmitting ? (isDelete ? 'Deleting…' : 'Saving…') : (isDelete ? 'Delete' : 'Save')}</button></div>
}
