import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  withCredentials: true,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const AuthContext = createContext(null)

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [sessionError, setSessionError] = useState('')

  const refreshProfile = useCallback(async () => {
    setSessionError('')

    try {
      const response = await apiClient.get('/api/users/profile')
      const profile = response.data?.data?.user

      if (!response.data?.success || !profile) {
        throw new Error(response.data?.message || 'Unable to load your profile')
      }

      setUser(profile)
      return profile
    } catch (error) {
      setUser(null)

      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        setSessionError(getErrorMessage(error, 'Unable to confirm your session'))
      }

      return null
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshProfile()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshProfile])

  const authenticate = useCallback(async (endpoint, payload, fallbackMessage) => {
    try {
      const response = await apiClient.post(endpoint, payload)
      const authenticatedUser = response.data?.data?.user

      if (!response.data?.success || !authenticatedUser) {
        throw new Error(response.data?.message || fallbackMessage)
      }

      setUser(authenticatedUser)
      setSessionError('')
      return authenticatedUser
    } catch (error) {
      throw new Error(getErrorMessage(error, fallbackMessage), { cause: error })
    }
  }, [])

  const login = useCallback(
    (credentials) => authenticate('/api/users/login', credentials, 'Unable to log in'),
    [authenticate],
  )

  const register = useCallback(
    (details) => authenticate('/api/users/register', details, 'Unable to create your account'),
    [authenticate],
  )

  const logout = useCallback(async () => {
    try {
      const response = await apiClient.post('/api/users/logout')

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to log out')
      }

      setUser(null)
      setSessionError('')
    } catch (error) {
      throw new Error(getErrorMessage(error, 'Unable to log out'), { cause: error })
    }
  }, [])

  const retrySession = useCallback(async () => {
    setIsLoadingSession(true)
    return refreshProfile()
  }, [refreshProfile])

  const value = useMemo(
    () => ({
      user,
      role: user ? 'user' : null,
      // Authentication is held in an httpOnly cookie, so JavaScript must never read or store the token.
      token: null,
      phone: user?.phone || '',
      isLoadingSession,
      sessionError,
      login,
      register,
      logout,
      refreshProfile,
      retrySession,
    }),
    [
      user,
      isLoadingSession,
      sessionError,
      login,
      register,
      logout,
      refreshProfile,
      retrySession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// This hook is deliberately exported alongside the provider to keep the authentication API cohesive.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
