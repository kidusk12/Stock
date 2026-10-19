import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { tokenStore, USER_KEY } from '../../lib/tokenStore'

const AuthContext = createContext(null)

function readCachedUser() {
  try {
    return tokenStore.get() ? JSON.parse(localStorage.getItem(USER_KEY)) : null
  } catch {
    return null
  }
}

function cacheUser(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // storage unavailable: ignore
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCachedUser)
  // true while we ask the server who the saved token belongs to
  const [checking, setChecking] = useState(() => Boolean(tokenStore.get()))

  // On page load, refresh the user from the server. Role and branch come from the
  // database, not from what we saved earlier (contract 1.2).
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    api
      .get('/auth/me')
      .then((fresh) => {
        if (!cancelled) {
          setUser(fresh)
          cacheUser(fresh)
        }
      })
      .catch(() => {
        // UNAUTHENTICATED / ACCOUNT_DISABLED are handled inside the API client (it logs out).
        // Any other error (e.g. server down): keep the saved user.
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // result is the login response: { token, expiresAt, user }
  const login = ({ token, user: loggedIn }) => {
    tokenStore.set(token)
    cacheUser(loggedIn)
    setUser(loggedIn)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout') // the server writes USER_LOGOUT to the audit log
    } catch {
      // log out locally even if the server call fails
    }
    tokenStore.clear()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, checking, login, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)