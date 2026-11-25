/**
 * ProtectedRoute.tsx
 * Chặn truy cập các trang nghiệp vụ nếu chưa đăng nhập.
 * - Nếu chưa xác thực → redirect /login (preserving intended URL).
 * - Nếu requireAdmin=true và user không phải Admin → hiện thông báo 403.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  requireAdmin?: boolean
}

export function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
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
