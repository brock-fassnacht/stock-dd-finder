import { useAuth } from '../auth/AuthContext'

type AuthButtonProps = {
  variant?: 'light' | 'dark'
}

export function AuthButton({ variant = 'light' }: AuthButtonProps) {
  const { authBusy, authReady, logout, openAuthModal, user } = useAuth()

  const baseClass = variant === 'dark'
    ? 'border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'

  if (!authReady) {
    return (
      <div className={`rounded-full border px-4 py-2 text-sm ${baseClass}`}>
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal('login')}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${baseClass}`}
      >
        Log in
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className={`rounded-full border px-4 py-2 text-sm ${baseClass}`}>
        {user.member_label}
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        disabled={authBusy}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${baseClass} disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {authBusy ? '...' : 'Log out'}
      </button>
    </div>
  )
}
