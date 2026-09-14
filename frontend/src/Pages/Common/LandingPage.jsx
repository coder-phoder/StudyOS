import { Link } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_80%_12%,rgba(34,211,238,0.22),transparent_28rem),radial-gradient(circle_at_15%_5%,rgba(99,102,241,0.18),transparent_24rem)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-5 sm:px-10">
        <header className="flex items-center justify-between">
          <AppLogo light />
          <Link
            to="/login"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-cyan-300 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            Log in
          </Link>
        </header>

        <section className="flex flex-1 items-center py-16 sm:py-24">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              Your calm corner for focused learning
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              A simpler home for your study life.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Start your StudyOS profile and keep your learning journey organized from one thoughtful place.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="rounded-xl bg-cyan-400 px-5 py-3 text-center text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Create your account
              </Link>
              <Link
                to="/login"
                className="rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-bold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 border-t border-slate-800 pt-6 text-sm text-slate-400 sm:grid-cols-3">
          <p><span className="font-semibold text-slate-200">Personal</span> — your profile, your space.</p>
          <p><span className="font-semibold text-slate-200">Secure</span> — sessions use httpOnly cookies.</p>
          <p><span className="font-semibold text-slate-200">Ready</span> — begin in a few moments.</p>
        </section>
      </div>
    </main>
  )
}
