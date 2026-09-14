import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppLogo from '../../Components/Common/AppLogo'
import { useAuth } from '../../Context/AuthContext'

const initialForm = {
  username: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  dob: '',
  gender: '',
  avatar: '',
  bio: '',
}

const today = new Date().toISOString().slice(0, 10)

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const validateForm = () => {
    if (!form.username.trim() || !form.phone.trim() || !form.email.trim() || !form.password || !form.dob || !form.gender) {
      return 'Please complete every required field.'
    }

    if (form.username.trim().length < 3) {
      return 'Username must be at least 3 characters.'
    }

    if (!/^\+?[1-9]\d{7,14}$/.test(form.phone.trim())) {
      return 'Enter a valid phone number, with an optional leading +.'
    }

    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return 'Enter a valid email address.'
    }

    if (form.password.length < 8) {
      return 'Password must be at least 8 characters.'
    }

    if (form.password !== form.confirmPassword) {
      return 'Your password confirmation does not match.'
    }

    if (form.dob >= today) {
      return 'Date of birth must be in the past.'
    }

    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      await register({
        username: form.username.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        dob: form.dob,
        gender: form.gender,
        avatar: form.avatar.trim(),
        bio: form.bio.trim(),
      })
      navigate('/user/home', { replace: true })
    } catch (submitError) {
      setError(submitError.message || 'Unable to create your account. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-100 sm:py-10">
      <section className="mx-auto w-full max-w-2xl rounded-[18px] border border-cyan-400/35 bg-slate-900 p-[22px] shadow-[0_12px_40px_rgba(0,0,0,0.55)] sm:p-7">
        <AppLogo light />
        <div className="mt-8">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-cyan-400">Get started</p>
          <h1 className="mt-2 text-[26px] font-bold">Create your StudyOS account</h1>
          <p className="mt-2 text-[13.5px] leading-6 text-slate-400">A few details are all it takes to set up your personal space.</p>
        </div>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          {error && (
            <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
              {error}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Username" name="username" value={form.username} onChange={handleChange} disabled={isSubmitting} autoComplete="username" required />
            <Field label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} disabled={isSubmitting} autoComplete="tel" placeholder="+919876543210" required />
            <Field label="Email address" name="email" type="email" value={form.email} onChange={handleChange} disabled={isSubmitting} autoComplete="email" placeholder="you@example.com" required />
            <Field label="Date of birth" name="dob" type="date" value={form.dob} onChange={handleChange} disabled={isSubmitting} max={today} required />
            <SelectField label="Gender" name="gender" value={form.gender} onChange={handleChange} disabled={isSubmitting} />
            <Field label="Avatar URL (optional)" name="avatar" type="url" value={form.avatar} onChange={handleChange} disabled={isSubmitting} placeholder="https://example.com/photo.jpg" />
            <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} disabled={isSubmitting} autoComplete="new-password" placeholder="At least 8 characters" required />
            <Field label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} disabled={isSubmitting} autoComplete="new-password" required />
          </div>
          <label className="block">
            <span className="text-sm font-medium text-slate-200">Short bio <span className="text-slate-500">(optional)</span></span>
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              disabled={isSubmitting}
              maxLength="500"
              rows="4"
              className="mt-1.5 w-full resize-y rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-[9px] text-[13.5px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Tell us a little about yourself."
            />
            <span className="mt-1 block text-right text-xs text-slate-500">{form.bio.length}/500</span>
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-[10px] border border-cyan-400 bg-cyan-400 px-4 py-[9px] text-[13px] font-bold text-[#04121a] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">Log in</Link>
        </p>
      </section>
    </main>
  )
}

function Field({ label, name, type = 'text', value, onChange, disabled, required, ...inputProps }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-slate-400">
        {label} {required && <span className="text-cyan-300">*</span>}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-[9px] text-[13.5px] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
        {...inputProps}
      />
    </label>
  )
}

function SelectField({ label, name, value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium uppercase tracking-[0.05em] text-slate-400">{label} <span className="text-cyan-300">*</span></span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required
        className="mt-1.5 w-full rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-[9px] text-[13.5px] text-slate-100 outline-none transition focus:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="" disabled>Select an option</option>
        <option value="female">Female</option>
        <option value="male">Male</option>
        <option value="non-binary">Non-binary</option>
        <option value="prefer-not-to-say">Prefer not to say</option>
      </select>
    </label>
  )
}
