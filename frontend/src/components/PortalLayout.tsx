/**
 * PortalLayout.tsx — khung cổng cư dân (role Resident). Gọn, ưu tiên màn hình điện thoại.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { NotificationBell } from './NotificationBell'

const LINKS = [
  { to: '/portal', label: 'Trang chủ', icon: '🏠', end: true },
  { to: '/portal/charges', label: 'Khoản phí', icon: '💰' },
  { to: '/portal/payments', label: 'Đã đóng', icon: '🧾' },
  { to: '/portal/notices', label: 'Giấy báo', icon: '📄' },
  { to: '/portal/household', label: 'Hộ của tôi', icon: '👨‍👩‍👧' },
]

export function PortalLayout() {
  const { user, logout } = useAuth()
  const { confirm } = useUI()
  const navigate = useNavigate()

  async function handleLogout() {
    const ok = await confirm('Bạn có chắc muốn đăng xuất?', { title: 'Đăng xuất', confirmText: 'Đăng xuất' })
    if (!ok) return
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <span className="brand-mark">B</span>
          <div>
            <div className="fw-bold">BlueMoon · Cổng cư dân</div>
            <div className="portal-sub">
              Căn {user?.apartmentCode ?? '—'} · Hộ {user?.householdCode ?? '—'}
            </div>
          </div>
        </div>
        <div className="header-right">
          <NotificationBell allLink="/portal/notifications" />
          <NavLink to="/portal/profile" className="btn btn-ghost btn-sm" title="Tài khoản">
            👤 <span className="hide-sm">{user?.fullName}</span>
          </NavLink>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>
      <nav className="portal-nav" aria-label="Cổng cư dân">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className="portal-link">
            <span aria-hidden="true">{l.icon}</span> {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="portal-content">
        <Outlet />
      </main>
    </div>
  )
}
