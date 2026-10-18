import { createContext, useContext, useState, useEffect } from 'react'
import { tokenStore } from '../../lib/tokenStore'

const AuthContext = createContext(null)
const STORAGE_KEY = 'sms_user'
const BRANCH_KEY = 'sms_selected_branch'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY))
    } catch {
      return null
    }
  })

  const [selectedBranchId, setSelectedBranchId] = useState(() => {
    try {
      const saved = localStorage.getItem(BRANCH_KEY)
      return saved ? Number(saved) : null
    } catch {
      return null
    }
  })

  // Whenever user changes, enforce branch rules
  useEffect(() => {
    if (user) {
      if (user.role === 'BRANCH_MANAGER' || user.role === 'STAFF') {
        setSelectedBranchId(user.branchId || 1)
        localStorage.setItem(BRANCH_KEY, String(user.branchId || 1))
      }
    } else {
      setSelectedBranchId(null)
      localStorage.removeItem(BRANCH_KEY)
    }
  }, [user])

  const login = (userData, token) => {
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    if (token) {
      tokenStore.set(token)
    } else {
      tokenStore.set(`mock-${userData.username}`)
    }
    if (userData.role === 'BRANCH_MANAGER' || userData.role === 'STAFF') {
      setSelectedBranchId(userData.branchId || 1)
    }
  }

  const logout = () => {
    setUser(null)
    tokenStore.clear()
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(BRANCH_KEY)
  }

  const changeBranch = (branchId) => {
    // Only Admin and Auditor can change branches freely
    if (user?.role === 'ADMIN' || user?.role === 'AUDITOR') {
      const bId = branchId ? Number(branchId) : null
      setSelectedBranchId(bId)
      if (bId) {
        localStorage.setItem(BRANCH_KEY, String(bId))
      } else {
        localStorage.removeItem(BRANCH_KEY)
      }
    }
  }

  const updateProfile = (updatedFields) => {
    setUser((prev) => {
      const updated = { ...prev, ...updatedFields }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        selectedBranchId,
        changeBranch,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)