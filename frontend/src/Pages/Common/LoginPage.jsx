import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'
import { useAuth } from '../../Context/AuthContext'

const initialForm = { identifier: '', password: '' }

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = location.state?.from || '/user/home'

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const identifier = form.identifier.trim()

    if (!identifier || !form.password) {
      setError('Enter your email or phone number and password.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await login({ identifier, password: form.password })
      navigate(redirectPath, { replace: true })
    } catch (submitError) {
      setError(submitError.message || 'Unable to log in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100 sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-[400px] rounded-[18px] border border-cyan-400/35 bg-slate-900 p-[22px] shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:p-7">
        <AppLogo light />
        <div className="mt-10">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-cyan-400">Welcome back</p>
          <h1 className="mt-2 text-[26px] font-bold">Log in to StudyOS</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-slate-400">Use the email address or phone number associated with your account.</p>
        </div>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          {error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
              {error}
            </div>
          )}
          <label className="block">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-slate-400">Email or phone number</span>
            <input
              name="identifier"
              type="text"
              autoComplete="username"
              value={form.identifier}
              onChange={handleChange}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-[9px] text-[13.5px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="you@example.com or +919876543210"
            />
          </label>
          <label className="block">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-slate-400">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              disabled={isSubmitting}
              className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-[9px] text-[13.5px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Your password"
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-[10px] border border-cyan-400 bg-cyan-400 px-4 py-[9px] text-[13px] font-bold text-[#04121a] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          New to StudyOS?{' '}
          <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200">Create an account</Link>
        </p>
      </section>
    </main>
  )
}
