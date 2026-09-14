export default function LoadingScreen({ label = 'Loading your StudyOS workspace…' }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 shadow-xl shadow-slate-950/30">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">{label}</p>
      </div>
    </main>
  )
}
