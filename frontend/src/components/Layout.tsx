import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/apartments', label: 'Apartments' },
  { to: '/households', label: 'Households' },
  { to: '/residents', label: 'Residents' },
  { to: '/fees', label: 'Fees' },
  { to: '/payments', label: 'Payments' },
]

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span> BlueMoon</div>
        <nav className="nav-list" aria-label="Main navigation">
          {links.map((link) => <NavLink key={link.to} className="nav-link" to={link.to}>{link.label}</NavLink>)}
        </nav>
      </aside>
      <div className="main-area">
        <header className="header">
          <div><div className="header-title">Apartment Management</div><div className="header-subtitle">Operations overview</div></div>
          <div className="user-chip">Administration</div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  )
}
