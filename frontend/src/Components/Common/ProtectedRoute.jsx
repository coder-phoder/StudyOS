import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
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
        <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl shadow-slate-950/40">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">Connection issue</p>
          <h1 className="mt-3 text-2xl font-bold">We could not load your session.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{sessionError}</p>
          <button
            type="button"
            onClick={() => void retrySession()}
            className="mt-6 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-900"
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
