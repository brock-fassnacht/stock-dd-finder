import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function AuthModal() {
  const {
    authBusy,
    authMode,
    closeAuthModal,
    isAuthModalOpen,
    login,
    openAuthModal,
    register,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!isAuthModalOpen) return null

  const submitLabel = authMode === 'login' ? 'Log in' : 'Create account'

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    try {
      if (authMode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      setEmail('')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={closeAuthModal}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-950 p-6 text-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Community Access</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {authMode === 'login' ? 'Log in to your account' : 'Create your account'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-stone-300 hover:border-white/20 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mb-5 flex gap-2 rounded-2xl bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setError(null)
              openAuthModal('login')
            }}
            className={`flex-1 rounded-xl px-3 py-2 ${authMode === 'login' ? 'bg-white text-stone-950' : 'text-stone-300 hover:text-white'}`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              openAuthModal('register')
            }}
            className={`flex-1 rounded-xl px-3 py-2 ${authMode === 'register' ? 'bg-white text-stone-950' : 'text-stone-300 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-stone-300">
            Email
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400"
              placeholder="you@example.com"
              autoFocus
              required
            />
          </label>

          <label className="block text-sm text-stone-300">
            Password
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400"
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          <p className="text-xs text-stone-500">
            Accounts use one email per member. Posting requires an account, while voting stays open to everyone.
          </p>

          {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={authBusy}
            className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-medium text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {authBusy ? 'Working...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
