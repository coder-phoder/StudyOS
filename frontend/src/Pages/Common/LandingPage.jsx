import { Link } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'

export default function LandingPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-5 py-10 text-slate-100">
      <div className="absolute left-5 top-5"><AppLogo light /></div>
      <section className="w-full max-w-2xl text-center">
        <h1 className="text-[28px] font-bold tracking-[-0.01em]">Who&apos;s studying today?</h1>
        <div className="mt-9 flex flex-wrap justify-center gap-6 sm:gap-10">
          <Link to="/login" className="group flex w-[150px] flex-col items-center gap-3.5 opacity-[0.88] transition hover:-translate-y-1 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50">
            <span className="grid h-[120px] w-[120px] place-items-center rounded-[20px] border-2 border-transparent bg-violet-400/20 [font-family:var(--font-display)] text-4xl font-bold text-cyan-400 transition group-hover:border-cyan-400 group-hover:shadow-[0_0_24px_rgba(196,181,253,0.35)]">↪</span>
            <span className="text-sm font-semibold text-slate-400 transition group-hover:text-slate-100">Log in</span>
          </Link>
          <Link to="/register" className="group flex w-[150px] flex-col items-center gap-3.5 opacity-[0.88] transition hover:-translate-y-1 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-400/50">
            <span className="grid h-[120px] w-[120px] place-items-center rounded-[20px] border-2 border-dashed border-violet-400/40 text-[40px] font-normal text-violet-400 transition group-hover:border-solid group-hover:bg-violet-400/14 group-hover:shadow-[0_0_24px_rgba(196,181,253,0.35)]">+</span>
            <span className="text-sm font-semibold text-slate-400 transition group-hover:text-slate-100">Add profile</span>
          </Link>
        </div>
        <p className="mt-10 text-[13px] text-slate-400">Sign in to continue with your private StudyOS workspace.</p>
      </section>
    </main>
  )
}
