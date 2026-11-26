/**
 * ProtectedRoute.tsx
 *  - Chưa đăng nhập → /login (giữ lại đường dẫn định vào).
 *  - Tài khoản phải đổi mật khẩu (mật khẩu tạm) → /change-password trước mọi trang khác.
 *  - roles: chỉ các vai trò này được vào.
 *      · Cư dân vào trang nhân viên → chuyển về /portal
 *      · Nhân viên vào cổng cư dân → chuyển về /
 *      · Kế toán vào trang chỉ dành cho Ban quản trị → thông báo 403
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types/auth'

interface ProtectedRouteProps {
  roles?: Role[]
  /** @deprecated dùng roles={['Admin']} */
  requireAdmin?: boolean
}

export function ProtectedRoute({ roles, requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  const allowed = roles ?? (requireAdmin ? ['Admin'] : undefined)
  if (allowed && !allowed.includes(user.role)) {
    if (user.role === 'Resident') return <Navigate to="/portal" replace />
    if (allowed.every((r) => r === 'Resident')) return <Navigate to="/" replace />
    return (
      <div className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: '0 0 8px' }}>Không có quyền truy cập</h2>
        <p style={{ color: '#718096', margin: 0 }}>
          Chức năng này chỉ dành cho tài khoản <strong>Ban quản trị (Admin)</strong>.
        </p>
      </div>
    )
  }

  return <Outlet />
}
