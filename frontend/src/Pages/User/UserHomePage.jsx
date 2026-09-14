import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLogo from '../../components/Common/AppLogo'
import { useAuth } from '../../context/AuthContext'

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

const displayGender = (gender) => {
  const genderLabels = {
    male: 'Male',
    female: 'Female',
    'non-binary': 'Non-binary',
    'prefer-not-to-say': 'Prefer not to say',
  }
  return genderLabels[gender] || 'Not specified'
}

const initialsFor = (name) =>
  (name || 'StudyOS')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export default function UserHomePage() {
  const navigate = useNavigate()
  const { user, logout, refreshProfile } = useAuth()
  const [imageFailed, setImageFailed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionError, setActionError] = useState('')

  const profile = useMemo(() => user || {}, [user])
  const showAvatar = Boolean(profile.avatar) && !imageFailed

  const handleLogout = async () => {
    setActionError('')
    setIsLoggingOut(true)

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setActionError(error.message || 'Unable to log out. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const handleRefresh = async () => {
    setActionError('')
    setIsRefreshing(true)

    try {
      const refreshedUser = await refreshProfile()
      if (!refreshedUser) {
        setActionError('Your profile could not be refreshed. Please try again.')
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <AppLogo light />
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="rounded-xl border border-slate-700 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:border-rose-400 hover:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-400">Your workspace</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {profile.username || 'there'}.</h1>
            <p className="mt-2 text-sm text-slate-400">Here is the complete profile connected to your account.</p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing || isLoggingOut}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh profile'}
          </button>
        </div>

        {actionError && (
          <div role="alert" className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/30">
          <div className="h-28 bg-[linear-gradient(105deg,#0e7490,#155e75_45%,#312e81)] sm:h-36" />
          <div className="px-5 pb-7 sm:px-8 sm:pb-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="-mt-12 flex items-end gap-4 sm:-mt-14">
                {showAvatar ? (
                  <img
                    src={profile.avatar}
                    alt={`${profile.username || 'User'} profile`}
                    onError={() => setImageFailed(true)}
                    className="h-24 w-24 rounded-2xl border-4 border-slate-900 object-cover sm:h-28 sm:w-28"
                  />
                ) : (
                  <div className="grid h-24 w-24 place-items-center rounded-2xl border-4 border-slate-900 bg-cyan-400 text-2xl font-black text-slate-950 sm:h-28 sm:w-28">
                    {initialsFor(profile.username)}
                  </div>
                )}
                <div className="pb-1">
                  <h2 className="text-xl font-bold sm:text-2xl">{profile.username || 'StudyOS member'}</h2>
                  <p className="mt-1 text-sm text-slate-400">{profile.email || 'No email address available'}</p>
                </div>
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${profile.isActive !== false ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-200'}`}>
                {profile.isActive !== false ? 'Active account' : 'Inactive account'}
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <ProfileItem label="Full name / username" value={profile.username} />
              <ProfileItem label="Email address" value={profile.email} />
              <ProfileItem label="Phone number" value={profile.phone} />
              <ProfileItem label="Date of birth" value={formatDate(profile.dob, profileDateFormatter)} />
              <ProfileItem label="Gender" value={displayGender(profile.gender)} />
              <ProfileItem label="Account ID" value={profile._id} mono />
              <ProfileItem label="Account created" value={formatDate(profile.createdAt, accountDateFormatter)} />
              <ProfileItem label="Last updated" value={formatDate(profile.updatedAt, accountDateFormatter)} />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Bio</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{profile.bio || 'No bio added yet.'}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function ProfileItem({ label, value, mono = false }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className={`mt-2 break-words text-sm text-slate-200 ${mono ? 'font-mono text-xs' : ''}`}>{value || 'Not available'}</p>
    </div>
  )
}
