export const TOKEN_KEY = 'sms_token'
export const USER_KEY = 'sms_user' // the key AuthContext uses

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // storage unavailable: ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {
      // storage unavailable: ignore
    }
  },
}