/**
 * Layout.tsx — Cập nhật Sprint 1
 * - Hiển thị tên và vai trò người dùng đang đăng nhập.
 * - Nút Đăng xuất: xóa phiên, redirect về /login.
 * - Sidebar mở rộng với đầy đủ menu Sprint 1.
 * - NavLink cho Dashboard dùng end={true} để tránh active khi ở sub-route.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/', label: '🏠 Dashboard', end: true },
  { to: '/apartments', label: '🏢 Căn hộ' },
  { to: '/households', label: '🏘 Hộ gia đình' },
  { to: '/residents', label: '👥 Nhân khẩu' },
  { to: '/resident-histories', label: '📋 Biến động cư trú' },
  { to: '/fee-categories', label: '📂 Danh mục khoản thu' },
  { to: '/fee-collections', label: '🗂 Đợt thu' },
  { to: '/fee-charges', label: '💰 Khoản phải thu' },
  { to: '/payments', label: '💳 Thanh toán' },
  { to: '/search', label: '🔍 Tra cứu' },
  { to: '/users', label: '👤 Tài khoản' },
]

export function Layout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const roleLabel = user?.role === 'Admin' ? 'Ban quản trị' : 'Kế toán'

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">B</span> BlueMoon
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              className="nav-link"
              to={link.to}
              end={link.end}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Profile link ở cuối sidebar */}
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #21405f' }}>
          <NavLink className="nav-link" to="/profile">
            ⚙️ Hồ sơ cá nhân
          </NavLink>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────── */}
      <div className="main-area">
        <header className="header">
          <div>
            <div className="header-title">Quản lý Chung cư BlueMoon</div>
            <div className="header-subtitle">Hệ thống nghiệp vụ nội bộ</div>
          </div>

          {/* User info + Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {user ? (
              <>
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="user-chip"
                    style={{ fontWeight: 700, fontSize: '.9rem', color: '#172033' }}
                  >
                    {user.fullName || user.username}
                  </div>
                  <div style={{ fontSize: '.78rem', color: '#718096', marginTop: 2 }}>
                    {roleLabel}
                    {!isAdmin && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: '.72rem',
                          background: '#fef3c7',
                          color: '#92400e',
                          borderRadius: 4,
                          padding: '1px 5px',
                        }}
                      >
                        Quyền hạn chế
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleLogout}
                  style={{ fontSize: '.85rem', padding: '7px 14px' }}
                  aria-label="Đăng xuất"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <div className="user-chip">Chưa đăng nhập</div>
            )}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
