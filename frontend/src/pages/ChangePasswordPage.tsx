/**
 * ChangePasswordPage.tsx — /change-password
 * Bắt buộc khi tài khoản đang dùng mật khẩu tạm (MustChangePassword).
 */
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ChangePasswordForm } from './ProfilePage'

export function ChangePasswordPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return <Navigate to="/login" replace />
  if (!user.mustChangePassword) return <Navigate to={user.role === 'Resident' ? '/portal' : '/'} replace />

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f7fb', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div className="brand-mark" style={{ display: 'inline-grid', marginBottom: 10 }}>
            B
          </div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Đặt mật khẩu mới</h1>
          <p className="text-muted" style={{ margin: '6px 0 0' }}>
            Xin chào <strong>{user.fullName}</strong>. Tài khoản đang dùng mật khẩu tạm — vui lòng đổi mật khẩu trước khi tiếp tục.
          </p>
        </div>
        <ChangePasswordForm onDone={() => navigate(user.role === 'Resident' ? '/portal' : '/', { replace: true })} />
        <button
          type="button"
          className="btn btn-ghost btn-sm mt-16"
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          ← Đăng xuất
        </button>
      </div>
    </div>
  )
}
