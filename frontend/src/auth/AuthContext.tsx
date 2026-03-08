import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, getStoredAuthToken, loginUser, logoutUser, registerUser, setStoredAuthToken } from '../api'
import type { User } from '../api'
import { AuthModal } from '../components/AuthModal'

type AuthMode = 'login' | 'register'

type AuthContextValue = {
  user: User | null
  authReady: boolean
  authBusy: boolean
  isAuthModalOpen: boolean
  authMode: AuthMode
  openAuthModal: (mode?: AuthMode) => void
  closeAuthModal: () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')

  useEffect(() => {
    const token = getStoredAuthToken()
    if (!token) {
      setAuthReady(true)
      return
    }

    getCurrentUser()
      .then(currentUser => setUser(currentUser))
      .catch(() => {
        setStoredAuthToken(null)
        setUser(null)
      })
      .finally(() => setAuthReady(true))
  }, [])

  const openAuthModal = (mode: AuthMode = 'login') => {
    setAuthMode(mode)
    setIsAuthModalOpen(true)
  }

  const closeAuthModal = () => {
    setIsAuthModalOpen(false)
  }

  const handleLogin = async (email: string, password: string) => {
    setAuthBusy(true)
    try {
      const session = await loginUser({ email, password })
      setStoredAuthToken(session.token)
      setUser(session.user)
      setIsAuthModalOpen(false)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleRegister = async (email: string, password: string) => {
    setAuthBusy(true)
    try {
      const session = await registerUser({ email, password })
      setStoredAuthToken(session.token)
      setUser(session.user)
      setIsAuthModalOpen(false)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    setAuthBusy(true)
    try {
      await logoutUser().catch(() => undefined)
      setStoredAuthToken(null)
      setUser(null)
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        authBusy,
        isAuthModalOpen,
        authMode,
        openAuthModal,
        closeAuthModal,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
      <AuthModal />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
