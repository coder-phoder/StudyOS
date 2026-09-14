import { Link } from 'react-router-dom'

export default function AppLogo({ light = false }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 [font-family:var(--font-display)] text-[19px] font-bold tracking-[-0.01em] ${light ? 'text-[#f2eee6]' : 'text-slate-950'}`}
      aria-label="StudyOS home"
    >
      <span className="h-[34px] w-[34px]" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
          <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" stroke="#a78bfa" strokeWidth="1.5" fill="rgba(167,139,250,0.08)" />
          <circle cx="20" cy="20" r="6" fill="#a78bfa" opacity="0.9" />
        </svg>
      </span>
      <span>Study<span className="text-cyan-400">OS</span></span>
    </Link>
  )
}
