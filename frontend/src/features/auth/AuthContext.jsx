import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { tokenStore } from '../../lib/tokenStore'

const AuthContext = createContext(null)
const STORAGE_KEY = 'sms_user'
const BRANCH_KEY = 'sms_selected_branch'
const BRANCH_ROLES = ['BRANCH_MANAGER', 'STAFF']

function readSelectedBranch() {
  try {
    const saved = localStorage.getItem(BRANCH_KEY)
    return saved ? Number(saved) : null
  } catch {
    return null
  }
}

function storeUser(user) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Authentication remains in memory if browser storage is unavailable.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokenStore.get()))
  const [selectedBranchId, setSelectedBranchId] = useState(readSelectedBranch)

  useEffect(() => {
    let active = true
    const token = tokenStore.get()

    if (!token) {
      storeUser(null)
      setLoading(false)
      return () => { active = false }
    }

    api.get('/auth/me')
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch(() => {
        tokenStore.clear()
        storeUser(null)
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) {
      setSelectedBranchId(null)
      try { localStorage.removeItem(BRANCH_KEY) } catch { /* storage may be unavailable */ }
      return
    }

    if (BRANCH_ROLES.includes(user.role)) {
      const branchId = Number.isInteger(user.branchId) ? user.branchId : null
      setSelectedBranchId(branchId)
      try {
        if (branchId === null) localStorage.removeItem(BRANCH_KEY)
        else localStorage.setItem(BRANCH_KEY, String(branchId))
      } catch { /* storage may be unavailable */ }
    }
  }, [user])

  const login = useCallback((userData, token) => {
    if (!userData || !token) throw new Error('Login response must include a user and token')
    tokenStore.set(token)
    storeUser(userData)
    setUser(userData)
    setLoading(false)
  }, [])

  const clearSession = useCallback(() => {
    tokenStore.clear()
    storeUser(null)
    setUser(null)
    setSelectedBranchId(null)
    try { localStorage.removeItem(BRANCH_KEY) } catch { /* storage may be unavailable */ }
  }, [])

  const logout = useCallback(async () => {
    try {
      if (tokenStore.get()) await api.post('/auth/logout', {})
    } finally {
      clearSession()
    }
  }, [clearSession])

  const changeBranch = (branchId) => {
    if (user?.role !== 'ADMIN' && user?.role !== 'AUDITOR') return
    const nextBranchId = branchId ? Number(branchId) : null
    setSelectedBranchId(nextBranchId)
    try {
      if (nextBranchId === null) localStorage.removeItem(BRANCH_KEY)
      else localStorage.setItem(BRANCH_KEY, String(nextBranchId))
    } catch { /* storage may be unavailable */ }
  }

  const updateProfile = (updatedFields) => {
    setUser((previous) => {
      if (!previous) return previous
      const updated = { ...previous, ...updatedFields }
      storeUser(updated)
      return updated
    })
  }

  return (
    <AuthContext.Provider value={{
      user, loading, selectedBranchId, changeBranch, login, logout, updateProfile,
      clearSession, isAuthenticated: Boolean(user),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
