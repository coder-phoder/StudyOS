import { Link } from 'react-router-dom'

export default function AppLogo({ light = false }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 font-bold tracking-tight ${light ? 'text-white' : 'text-slate-950'}`}
      aria-label="StudyOS home"
    >
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400 text-lg text-slate-950 shadow-sm shadow-cyan-500/40">
        S
      </span>
      <span className="text-lg">StudyOS</span>
    </Link>
  )
}
