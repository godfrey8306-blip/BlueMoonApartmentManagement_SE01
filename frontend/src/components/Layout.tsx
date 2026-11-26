/**
 * Layout.tsx — khung ứng dụng cho nhân viên (Ban quản trị, Kế toán).
 *  - Menu lọc theo vai trò (ma trận quyền ở docs/03_USER_STORY_TRACEABILITY.md).
 *  - Header: tìm kiếm toàn cục (Ctrl+K), chuông thông báo, thông tin tài khoản, đăng xuất.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { GlobalSearch } from './GlobalSearch'
import { NotificationBell } from './NotificationBell'
import { ROLE_LABELS } from '../lib/format'
import type { Role } from '../types/auth'

interface NavItem {
  to: string
  label: string
  end?: boolean
  roles?: Role[]
}

const NAV_SECTIONS: { title?: string; links: NavItem[] }[] = [
  { links: [{ to: '/', label: '🏠 Tổng quan', end: true }] },
  {
    title: 'Cư dân',
    links: [
      { to: '/apartments', label: '🏢 Căn hộ' },
      { to: '/households', label: '🏘 Hộ gia đình' },
      { to: '/residents', label: '👥 Nhân khẩu' },
      { to: '/resident-histories', label: '📋 Biến động cư trú', roles: ['Admin'] },
    ],
  },
  {
    title: 'Thu phí',
    links: [
      { to: '/fee-categories', label: '📂 Danh mục khoản thu' },
      { to: '/fee-collections', label: '🗂 Đợt thu & giấy báo' },
      { to: '/fee-charges', label: '💰 Công nợ' },
      { to: '/payments', label: '💳 Thanh toán' },
    ],
  },
  {
    title: 'Hệ thống',
    links: [
      { to: '/search', label: '🔍 Tra cứu' },
      { to: '/notifications', label: '🔔 Thông báo' },
      { to: '/users', label: '👤 Tài khoản', roles: ['Admin'] },
    ],
  },
]

export function Layout() {
  const { user, logout } = useAuth()
  const { confirm } = useUI()
  const navigate = useNavigate()

  async function handleLogout() {
    const ok = await confirm('Bạn có chắc muốn đăng xuất khỏi hệ thống?', { title: 'Đăng xuất', confirmText: 'Đăng xuất' })
    if (!ok) return
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">B</span> BlueMoon
        </div>

        <nav className="nav-list" aria-label="Main navigation">
          {NAV_SECTIONS.map((section, i) => {
            const links = section.links.filter((l) => !l.roles || (user && l.roles.includes(user.role)))
            if (links.length === 0) return null
            return (
              <div key={section.title ?? i} style={{ display: 'contents' }}>
                {section.title && <div className="nav-section">{section.title}</div>}
                {links.map((link) => (
                  <NavLink key={link.to} className="nav-link" to={link.to} end={link.end}>
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid #21405f' }}>
          <NavLink className="nav-link" to="/profile">
            ⚙️ Hồ sơ cá nhân
          </NavLink>
        </div>
      </aside>

      <div className="main-area">
        <header className="header">
          <GlobalSearch />
          <div className="header-right">
            <NotificationBell allLink="/notifications" />
            {user && (
              <div style={{ textAlign: 'right' }}>
                <div className="fw-bold" style={{ fontSize: '.9rem' }}>
                  {user.fullName || user.username}
                </div>
                <div style={{ fontSize: '.78rem', color: '#718096', marginTop: 2 }}>{ROLE_LABELS[user.role]}</div>
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout} aria-label="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
