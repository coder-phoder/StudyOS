export default function LoadingScreen({ label = 'Loading your StudyOS workspace…' }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="flex items-center gap-3 rounded-[18px] border border-white/[0.09] bg-white/[0.045] px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">{label}</p>
      </div>
    </main>
  )
}
