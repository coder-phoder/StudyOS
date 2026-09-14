import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'
import RichNoteEditor from '../../Components/Notes/RichNoteEditor'
import { plainTextFromHtml, sanitizeRichHtml } from '../../Components/Notes/noteEditorHelpers'
import { useAuth } from '../../Context/AuthContext'

const notesApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const getResponseData = (response, fallbackMessage) => {
  if (!response.data?.success) throw new Error(response.data?.message || fallbackMessage)
  return response.data.data
}

const getNotes = async () => getResponseData(await notesApiClient.get('/api/notes'), 'Unable to load your notes').notes || []
const getNote = async (noteId) => getResponseData(await notesApiClient.get(`/api/notes/${noteId}`), 'Unable to load this note').note
const createNote = async (note) => getResponseData(await notesApiClient.post('/api/notes', note), 'Unable to create your note').note
const updateNote = async (noteId, note) => getResponseData(await notesApiClient.put(`/api/notes/${noteId}`, note), 'Unable to save your note').note
const deleteNote = async (noteId) => getResponseData(await notesApiClient.delete(`/api/notes/${noteId}`), 'Unable to delete your note')

const noteDateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback

const toSummary = (note) => ({
  _id: note._id,
  title: note.title || 'Untitled',
  tags: note.tags || [],
  preview: plainTextFromHtml(note.body).slice(0, 180),
  attachment: note.attachment ? {
    name: note.attachment.name,
    mimeType: note.attachment.mimeType,
    size: note.attachment.size,
  } : null,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
})

const formatNoteDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : noteDateFormatter.format(date)
}

const initialsFor = (name) => (name || 'StudyOS')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

export default function MyNotesPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [notes, setNotes] = useState([])
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingNote, setIsLoadingNote] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [actionError, setActionError] = useState('')
  const draftRef = useRef(null)
  const draftVersionRef = useRef(0)
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef(null)
  const saveQueueRef = useRef(Promise.resolve())
  const loadRequestRef = useRef(0)
  const titleInputRef = useRef(null)

  const mergeSummary = useCallback((note) => {
    const summary = toSummary(note)
    setNotes((currentNotes) => [
      summary,
      ...currentNotes.filter((item) => item._id !== note._id),
    ].sort((first, second) => new Date(second.updatedAt) - new Date(first.updatedAt)))
  }, [])

  const saveNow = useCallback(async () => {
    if (!draftRef.current || !dirtyRef.current) return true

    window.clearTimeout(saveTimerRef.current)
    const noteToSave = draftRef.current
    const versionAtSave = draftVersionRef.current
    const task = async () => {
      setSaveState('saving')
      try {
        const savedNote = await updateNote(noteToSave._id, {
          title: noteToSave.title.trim() || 'Untitled',
          body: sanitizeRichHtml(noteToSave.body),
          tags: noteToSave.tags || [],
          attachment: noteToSave.attachment || null,
        })
        mergeSummary(savedNote)
        if (draftVersionRef.current === versionAtSave) {
          dirtyRef.current = false
          setSaveState('saved')
        } else {
          setSaveState('unsaved')
        }
        return true
      } catch (error) {
        setSaveState('error')
        setActionError(getErrorMessage(error, 'Unable to save your note. Your changes are still in this page.'))
        return false
      }
    }

    const queuedSave = saveQueueRef.current.then(task, task)
    saveQueueRef.current = queuedSave.catch(() => undefined)
    return queuedSave
  }, [mergeSummary])

  const queueSave = useCallback(() => {
    window.clearTimeout(saveTimerRef.current)
    setSaveState('unsaved')
    saveTimerRef.current = window.setTimeout(() => {
      void saveNow()
    }, 650)
  }, [saveNow])

  const applyDraftChanges = useCallback((changes) => {
    if (!draftRef.current) return
    const nextDraft = { ...draftRef.current, ...changes }
    draftRef.current = nextDraft
    draftVersionRef.current += 1
    dirtyRef.current = true
    setDraft(nextDraft)
    queueSave()
  }, [queueSave])

  const openNote = useCallback(async (noteId) => {
    if (!noteId || noteId === draftRef.current?._id) return
    const saved = await saveNow()
    if (!saved) return

    const requestId = ++loadRequestRef.current
    setActionError('')
    setSelectedNoteId(noteId)
    setDraft(null)
    setIsLoadingNote(true)

    try {
      const note = await getNote(noteId)
      if (requestId !== loadRequestRef.current) return
      draftRef.current = { ...note, body: sanitizeRichHtml(note.body) }
      draftVersionRef.current += 1
      dirtyRef.current = false
      setDraft(draftRef.current)
      setSaveState('saved')
    } catch (error) {
      if (requestId !== loadRequestRef.current) return
      setSelectedNoteId(null)
      draftRef.current = null
      setActionError(getErrorMessage(error, 'Unable to load this note.'))
    } finally {
      if (requestId === loadRequestRef.current) setIsLoadingNote(false)
    }
  }, [saveNow])

  const loadNotes = useCallback(async () => {
    const requestId = ++loadRequestRef.current
    setIsLoading(true)
    setActionError('')

    try {
      const loadedNotes = await getNotes()
      if (requestId !== loadRequestRef.current) return
      setNotes(loadedNotes)
      setIsLoading(false)
      if (loadedNotes[0]) {
        setSelectedNoteId(null)
        draftRef.current = null
        await openNote(loadedNotes[0]._id)
      }
    } catch (error) {
      if (requestId === loadRequestRef.current) setActionError(getErrorMessage(error, 'Unable to load your notes.'))
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false)
    }
  }, [openNote])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadNotes()
    }, 0)
    return () => {
      window.clearTimeout(loadTimer)
      window.clearTimeout(saveTimerRef.current)
    }
  }, [loadNotes])

  const handleCreate = async () => {
    const saved = await saveNow()
    if (!saved) return

    setActionError('')
    setIsCreating(true)
    try {
      const note = await createNote({ title: 'Untitled', body: '', tags: [], attachment: null })
      mergeSummary(note)
      draftRef.current = note
      draftVersionRef.current += 1
      dirtyRef.current = false
      setSelectedNoteId(note._id)
      setDraft(note)
      setSaveState('saved')
      window.setTimeout(() => titleInputRef.current?.focus(), 0)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to create a new note.'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!draftRef.current || isDeleting) return
    if (!window.confirm(`Delete “${draftRef.current.title || 'Untitled'}”? This cannot be undone.`)) return

    const saved = await saveNow()
    if (!saved) return

    const deletedId = draftRef.current._id
    setActionError('')
    setIsDeleting(true)
    try {
      await deleteNote(deletedId)
      const remainingNotes = notes.filter((item) => item._id !== deletedId)
      setNotes(remainingNotes)
      setSelectedNoteId(null)
      setDraft(null)
      draftRef.current = null
      dirtyRef.current = false
      if (remainingNotes[0]) await openNote(remainingNotes[0]._id)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to delete this note.'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleLogout = async () => {
    const saved = await saveNow()
    if (!saved) return
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setActionError(getErrorMessage(error, 'Unable to log out.'))
      setIsLoggingOut(false)
    }
  }

  const availableTags = useMemo(
    () => [...new Set(notes.flatMap((note) => note.tags || []))].sort((first, second) => first.localeCompare(second)),
    [notes],
  )

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return notes.filter((note) => {
      const matchesTag = !activeTag || note.tags?.includes(activeTag)
      const haystack = `${note.title} ${note.preview} ${(note.tags || []).join(' ')}`.toLowerCase()
      return matchesTag && (!query || haystack.includes(query))
    })
  }, [activeTag, notes, searchQuery])

  const saveLabel = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }[saveState]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <AppLogo light />
            <nav aria-label="User navigation" className="flex items-center gap-1 text-sm font-semibold">
              <Link to="/user/home" className="rounded-lg px-3 py-2 text-slate-400 transition hover:text-white">Profile</Link>
              <Link to="/user/notes" className="rounded-lg bg-violet-400/15 px-3 py-2 text-violet-200">My Notes</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span title={user?.username} className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-xs font-black text-slate-950">{initialsFor(user?.username)}</span>
            <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-rose-400 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60">{isLoggingOut ? 'Logging out…' : 'Log out'}</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-400">Your workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My Notes</h1>
            <p className="mt-2 text-sm text-slate-400">Capture ideas, structure your study material, and keep files with their context.</p>
          </div>
          <button type="button" onClick={() => void handleCreate()} disabled={isCreating || isLoading} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">{isCreating ? 'Creating…' : '+ New Note'}</button>
        </div>

        {actionError && <div role="alert" className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"><span>{actionError}</span><button type="button" onClick={() => setActionError('')} className="font-semibold hover:text-white">Dismiss</button></div>}

        <section className="mt-7 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/30">
          <div className="grid min-h-[36rem] lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-950/45 lg:border-r lg:border-b-0">
              <div className="border-b border-slate-800 p-3">
                <label className="sr-only" htmlFor="notes-search">Search notes</label>
                <input id="notes-search" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search notes" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20" />
                {availableTags.length > 0 && <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto"><button type="button" onClick={() => setActiveTag('')} className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${!activeTag ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>All</button>{availableTags.map((tag) => <button key={tag} type="button" onClick={() => setActiveTag(tag)} className={`max-w-36 truncate rounded-full border px-2.5 py-1 text-xs font-semibold transition ${activeTag === tag ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{tag}</button>)}</div>}
              </div>
              <div className="min-h-52 flex-1 overflow-y-auto p-2">
                {isLoading ? <p className="px-3 py-5 text-sm text-slate-500">Loading your notes…</p> : filteredNotes.length ? filteredNotes.map((note) => <button key={note._id} type="button" onClick={() => void openNote(note._id)} className={`mb-1 w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-300 ${selectedNoteId === note._id ? 'border-violet-400/30 bg-violet-400/10' : 'border-transparent hover:bg-slate-800/70'}`}><div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-semibold text-slate-100">{note.title || 'Untitled'}</p><span className="shrink-0 text-xs text-slate-500">{formatNoteDate(note.updatedAt)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{note.preview || (note.attachment ? 'Attachment' : 'No additional text')}</p><div className="mt-2 flex min-h-4 flex-wrap gap-1 text-[11px] text-violet-200">{note.attachment && <span aria-label="Has attachment">📎</span>}{note.tags?.slice(0, 2).map((tag) => <span key={tag} className="max-w-28 truncate rounded-full bg-violet-400/10 px-1.5 py-0.5">{tag}</span>)}</div></button>) : <p className="px-3 py-5 text-sm text-slate-500">{notes.length ? 'No notes match this filter.' : 'No notes yet. Create one to get started.'}</p>}
              </div>
            </aside>

            <div className="min-w-0">
              {isLoadingNote ? <div className="grid min-h-[34rem] place-items-center text-sm text-slate-500">Opening note…</div> : draft ? <><div className="flex items-center justify-between border-b border-slate-800 px-5 py-2.5"><span className={`text-xs font-semibold ${saveState === 'error' ? 'text-rose-300' : saveState === 'saved' ? 'text-emerald-300' : 'text-amber-300'}`}>{saveLabel}</span><button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-400/10 hover:text-rose-200 disabled:cursor-not-allowed">{isDeleting ? 'Deleting…' : 'Delete note'}</button></div><RichNoteEditor key={draft._id} note={draft} notes={notes} onChange={applyDraftChanges} onAttach={(attachment) => applyDraftChanges({ attachment })} onRemoveAttachment={() => applyDraftChanges({ attachment: null })} onOpenNote={(noteId) => void openNote(noteId)} titleInputRef={titleInputRef} /></> : <div className="grid min-h-[34rem] place-items-center px-6 text-center"><div><p className="text-base font-semibold text-slate-300">Select a note or create a new one.</p><p className="mt-2 text-sm leading-6 text-slate-500">Use the editor for headings, highlights, checklists, tables, and file attachments.</p></div></div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
