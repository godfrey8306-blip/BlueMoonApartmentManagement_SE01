/**
 * main.tsx — Entry point
 *  - /login, /change-password: công khai / bắt buộc đổi mật khẩu tạm
 *  - Nhân viên (Admin + Kế toán) dùng <Layout>; một số trang chỉ Admin
 *  - Cư dân (Resident) dùng cổng /portal với <PortalLayout>
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { PortalLayout } from './components/PortalLayout'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { ProfilePage } from './pages/ProfilePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { DashboardPage } from './pages/DashboardPage'
import { ApartmentsPage } from './pages/ApartmentsPage'
import { HouseholdsPage } from './pages/HouseholdsPage'
import { ResidentsPage } from './pages/ResidentsPage'
import { ResidentHistoriesPage } from './pages/ResidentHistoriesPage'
import { FeeCategoriesPage } from './pages/FeeCategoriesPage'
import { FeeCollectionsPage } from './pages/FeeCollectionsPage'
import { FeeNoticesPage } from './pages/FeeNoticesPage'
import { FeeChargesPage } from './pages/FeeChargesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { SearchPage } from './pages/SearchPage'
import { UsersPage } from './pages/UsersPage'
import {
  PortalChargesPage,
  PortalHomePage,
  PortalHouseholdPage,
  PortalNoticesPage,
  PortalPaymentsPage,
} from './pages/portal/PortalPages'

import './styles.css'

function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 400, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>404</div>
      <h2 style={{ margin: '0 0 8px' }}>Trang không tồn tại</h2>
      <p style={{ color: '#718096', margin: '0 0 20px' }}>Đường dẫn bạn truy cập không hợp lệ.</p>
      <Link to="/" className="btn btn-primary">
        Về trang chủ
      </Link>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* ── Nhân viên: Ban quản trị + Kế toán ─────────── */}
            <Route element={<ProtectedRoute roles={['Admin', 'User']} />}>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="apartments" element={<ApartmentsPage />} />
                <Route path="households" element={<HouseholdsPage />} />
                <Route path="residents" element={<ResidentsPage />} />
                <Route path="fee-categories" element={<FeeCategoriesPage />} />
                <Route path="fee-collections" element={<FeeCollectionsPage />} />
                <Route path="fee-collections/:id/notices" element={<FeeNoticesPage />} />
                <Route path="fee-charges" element={<FeeChargesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="search" element={<SearchPage />} />

                {/* ── Chỉ Ban quản trị ── */}
                <Route element={<ProtectedRoute roles={['Admin']} />}>
                  <Route path="resident-histories" element={<ResidentHistoriesPage />} />
                  <Route path="users" element={<UsersPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>

            {/* ── Cổng cư dân ───────────────────────────────── */}
            <Route element={<ProtectedRoute roles={['Resident']} />}>
              <Route path="portal" element={<PortalLayout />}>
                <Route index element={<PortalHomePage />} />
                <Route path="charges" element={<PortalChargesPage />} />
                <Route path="payments" element={<PortalPaymentsPage />} />
                <Route path="notices" element={<PortalNoticesPage />} />
                <Route path="household" element={<PortalHouseholdPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            </Route>
          </Routes>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
