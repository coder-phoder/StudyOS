import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from './AppLogo'
import { useAuth } from '../../Context/AuthContext'

const getInitials = (name) => (name || 'StudyOS')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

const formatClock = (date) => new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
}).format(date)

const formatDate = (date) => new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}).format(date)

export default function WorkspaceHeader({ activeTab }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const tabClass = (tab) => `rounded-full px-4 py-2 text-[13px] font-semibold transition ${activeTab === tab ? 'bg-cyan-400/14 text-cyan-400 shadow-[inset_0_0_0_1px_rgba(196,181,253,0.35)]' : 'text-slate-400 hover:text-slate-100'}`

  return (
    <>
      <header className="mb-[22px] flex flex-nowrap items-start justify-between gap-4 max-[640px]:flex-wrap">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
          <AppLogo light />
          <nav aria-label="Workspace navigation" className="flex max-w-full overflow-x-auto rounded-full border border-white/[0.09] bg-white/[0.045] p-1">
            <Link to="/user/home" className={tabClass('Dashboard')}>Dashboard</Link>
            <Link to="/user/semesters" className={tabClass('Semesters')}>Semesters</Link>
            <Link to="/user/calendar" className={tabClass('Calendar')}>Calendar</Link>
            <Link to="/user/coding-time" className={`${tabClass('Coding Time')} whitespace-nowrap`}>Coding Time</Link>
            <Link to="/user/notes" className={tabClass('Notes')}>Notes</Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <input type="search" readOnly aria-label="Global search" title="Search is not part of the current workspace" placeholder="Search topics, notes, tasks…" className="w-[200px] rounded-full border border-white/[0.09] bg-white/[0.045] px-3.5 py-2 text-[12.5px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:w-60 focus:border-cyan-400/50 max-[720px]:hidden" />
          <button type="button" onClick={() => navigate('/user/profile')} title="Open profile" className="flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.045] py-1 pl-1 pr-3.5 text-left transition hover:border-cyan-400/35 hover:bg-white/[0.075] max-[640px]:pr-1">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-linear-to-br from-violet-400/40 to-violet-400/10 [font-family:var(--font-display)] text-[11px] font-bold text-cyan-400">{getInitials(user?.username)}</span>
              <span className="flex flex-col items-start leading-tight max-[640px]:hidden">
              <span className="text-[11.5px] font-bold text-slate-100">{user?.username || 'StudyOS'}</span>
              <span className="font-mono text-[12.5px] tracking-[0.03em] text-cyan-400">{formatClock(now)}</span>
              <span className="font-mono text-[10px] tracking-[0.02em] text-slate-400">{formatDate(now)}</span>
            </span>
          </button>
        </div>
      </header>
    </>
  )
}
