/**
 * AuthContext.tsx
 * Quản lý trạng thái xác thực toàn ứng dụng.
 * - Lưu token & user vào localStorage để F5 không mất phiên.
 * - Cung cấp hàm login(), logout(), và user info.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { TOKEN_KEY, USER_KEY } from '../lib/apiClient'
import type { UserResponse } from '../types/auth'
import { getMe } from '../lib/authService'

function readStoredToken(): string | null {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw || raw === 'undefined' || raw === 'null') {
    localStorage.removeItem(TOKEN_KEY)
    return null
  }
  return raw
}

function readStoredUser(): UserResponse | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw || raw === 'undefined' || raw === 'null') {
    localStorage.removeItem(USER_KEY)
    return null
  }
  try {
    const parsed = JSON.parse(raw) as UserResponse
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'number' || !parsed.username) {
      localStorage.removeItem(USER_KEY)
      return null
    }
    return parsed
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

// ── Context shape ────────────────────────────────────────────
interface AuthContextValue {
  user: UserResponse | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Ban quản trị hoặc Kế toán */
  isStaff: boolean
  isResident: boolean
  login: (token: string, user: UserResponse) => void
  /** Cập nhật thông tin user (sau khi sửa hồ sơ / đổi mật khẩu) */
  setUser: (user: UserResponse) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken)
  const [user, setUser] = useState<UserResponse | null>(readStoredUser)

  // Đồng bộ state với localStorage (đề phòng tab khác xóa token)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        const nextToken = readStoredToken()
        setToken(nextToken)
        if (!nextToken) setUser(null)
      }
      if (e.key === USER_KEY) {
        setUser(readStoredUser())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const login = useCallback((newToken: string, newUser: UserResponse) => {
    if (!newToken || !newUser || typeof newUser !== 'object') {
      return
    }
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const updateStoredUser = useCallback((next: UserResponse) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next))
    setUser(next)
  }, [])

  // Đồng bộ lại thông tin tài khoản từ server khi mở app (role / hộ có thể đã đổi)
  useEffect(() => {
    if (!token) return
    getMe()
      .then((me) => updateStoredUser(me))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'Admin',
      isStaff: user?.role === 'Admin' || user?.role === 'User',
      isResident: user?.role === 'Resident',
      login,
      setUser: updateStoredUser,
      logout,
    }),
    [user, token, login, logout, updateStoredUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ── Hook ─────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
