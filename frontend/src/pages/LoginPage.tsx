/**
 * LoginPage.tsx
 * Trang đăng nhập — Route: /login
 * - Form nhập username + password, validate đầu vào.
 * - Trạng thái Loading khi gửi request.
 * - Hiển thị lỗi rõ ràng từ server.
 * - Nếu đã đăng nhập → redirect về trang chủ.
 */
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { login as loginApi } from '../lib/authService'
import { Feedback } from '../components/Feedback'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // Nếu đã đăng nhập, chuyển về trang trước hoặc trang chủ
  const rawFrom = (location.state as { from?: { pathname?: string } })?.from?.pathname
  const from = rawFrom && rawFrom !== '/login' ? rawFrom : '/'
  if (isAuthenticated) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)

    // Validate đầu vào phía client
    if (!username.trim()) {
      setError('Vui lòng nhập tên đăng nhập.')
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.')
      return
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.')
      return
    }

    setLoading(true)
    try {
      const res = await loginApi({ username: username.trim(), password })
      if (!res?.accessToken || !res?.user) {
        setError('Phản hồi đăng nhập không hợp lệ từ máy chủ.')
        return
      }
      login(res.accessToken, res.user)
      navigate(from, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đã có lỗi xảy ra.'
      // Map thông báo lỗi tiếng Anh của server sang tiếng Việt
      if (msg.toLowerCase().includes('invalid username or password')) {
        setError('Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại.')
      } else if (msg.toLowerCase().includes('locked') || msg.toLowerCase().includes('inactive')) {
        setError('Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f7fb',
        padding: '20px',
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#38bdf8',
              color: '#082f49',
              display: 'inline-grid',
              placeItems: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              marginBottom: 12,
            }}
          >
            B
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#132238' }}>
            BlueMoon
          </h1>
          <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '0.9rem' }}>
            Hệ thống Quản lý Chung cư
          </p>
        </div>

        <Feedback error={error} />

        <form onSubmit={handleSubmit} noValidate>
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="username">Tên đăng nhập</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              maxLength={100}
              placeholder="Nhập tên đăng nhập"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="field" style={{ marginBottom: 24 }}>
            <label htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              maxLength={200}
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
          >
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  )
}
