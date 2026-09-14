import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../Context/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function ProtectedRoute({ children }) {
  const { user, isLoadingSession, sessionError, retrySession } = useAuth()
  const location = useLocation()

  if (isLoadingSession) {
    return <LoadingScreen />
  }

  if (sessionError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
        <section className="w-full max-w-md rounded-[18px] border border-cyan-400/35 bg-slate-900 p-7 text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-cyan-400">Connection issue</p>
          <h1 className="mt-3 text-2xl font-bold">We could not load your session.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{sessionError}</p>
          <button
            type="button"
            onClick={() => void retrySession()}
            className="mt-6 rounded-[10px] border border-cyan-400 bg-cyan-400 px-[15px] py-[9px] text-[13px] font-bold text-[#04121a] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            Try again
          </button>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
