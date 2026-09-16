import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WorkspaceHeader from '../../Components/Common/WorkspaceHeader'
import { useAuth } from '../../Context/AuthContext'

const profileDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const accountDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const formatDate = (value, formatter) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? formatter.format(date) : 'Not available'
}

const displayGender = (gender) => ({
  male: 'Male',
  female: 'Female',
  'non-binary': 'Non-binary',
  'prefer-not-to-say': 'Prefer not to say',
}[gender] || 'Not specified')

const initialsFor = (name) => (name || 'StudyOS').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, refreshProfile, logout } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [actionError, setActionError] = useState('')
  const profile = useMemo(() => user || {}, [user])
  const showAvatar = Boolean(profile.avatar) && !imageFailed

  const handleRefresh = async () => {
    setActionError('')
    setIsRefreshing(true)
    try {
      if (!await refreshProfile()) setActionError('Your profile could not be refreshed. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleLogout = async () => {
    setActionError('')
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setActionError(error.message || 'Unable to log out. Please try again.')
      setIsLoggingOut(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1180px] px-5 pb-24 pt-5">
        <WorkspaceHeader />
        <div className="mb-[14px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="m-0 text-[24px] font-bold">Profile</h1><p className="mt-1 text-[13px] text-slate-400">Your StudyOS account details.</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing || isLoggingOut} className="rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-[15px] py-[9px] text-[13px] font-semibold text-slate-100 transition hover:border-cyan-400/40 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-60">{isRefreshing ? 'Refreshing…' : 'Refresh profile'}</button><button type="button" onClick={() => void handleLogout()} disabled={isRefreshing || isLoggingOut} className="rounded-[10px] border border-rose-300/35 bg-rose-400/10 px-[15px] py-[9px] text-[13px] font-semibold text-rose-100 transition hover:bg-rose-400/16 disabled:cursor-not-allowed disabled:opacity-60">{isLoggingOut ? 'Logging out…' : 'Log out'}</button></div>
        </div>
        {actionError && <div role="alert" className="mb-[14px] rounded-xl border border-rose-400/35 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{actionError}</div>}
        <section className="relative overflow-hidden rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-5 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.6)] before:pointer-events-none before:absolute before:inset-0 before:bg-linear-to-br before:from-white/[0.05] before:to-transparent before:content-['']">
          <div className="relative"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4">{showAvatar ? <img src={profile.avatar} alt={`${profile.username || 'User'} profile`} onError={() => setImageFailed(true)} className="h-20 w-20 rounded-[14px] border border-cyan-400/35 object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-[14px] border border-cyan-400/35 bg-violet-400/15 font-display text-2xl font-bold text-cyan-400">{initialsFor(profile.username)}</div>}<div><h2 className="m-0 text-xl font-bold">{profile.username || 'StudyOS member'}</h2><p className="mt-1 text-sm text-slate-400">{profile.email || 'No email address available'}</p></div></div><span className={`w-fit rounded-full px-3 py-1 text-[11px] font-bold ${profile.isActive !== false ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-200'}`}>{profile.isActive !== false ? 'Active account' : 'Inactive account'}</span></div>
            <div className="mt-6 grid gap-[14px] md:grid-cols-2"><ProfileItem label="Full name / username" value={profile.username} /><ProfileItem label="Email address" value={profile.email} /><ProfileItem label="Phone number" value={profile.phone} /><ProfileItem label="Date of birth" value={formatDate(profile.dob, profileDateFormatter)} /><ProfileItem label="Gender" value={displayGender(profile.gender)} /><ProfileItem label="Account ID" value={profile._id} mono /><ProfileItem label="Account created" value={formatDate(profile.createdAt, accountDateFormatter)} /><ProfileItem label="Last updated" value={formatDate(profile.updatedAt, accountDateFormatter)} /></div>
            <div className="mt-[14px] rounded-[12px] border border-white/[0.09] bg-black/15 p-4"><p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Bio</p><p className="mb-0 mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{profile.bio || 'No bio added yet.'}</p></div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ProfileItem({ label, value, mono = false }) {
  return <div className="rounded-[12px] border border-white/[0.09] bg-white/[0.03] p-[14px]"><p className="m-0 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</p><p className={`mt-2 break-words text-[13px] text-slate-200 ${mono ? 'font-mono text-[11px]' : ''}`}>{value || 'Not available'}</p></div>
}
