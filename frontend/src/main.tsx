/**
 * main.tsx — Entry point Sprint 1
 * - Bọc toàn bộ app trong <AuthProvider>.
 * - Khai báo đầy đủ routes Sprint 1 với ProtectedRoute.
 * - Route /login là public, mọi route còn lại cần xác thực.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { PageHeader } from './components/PageHeader'

import './styles.css'

/** Placeholder tạm thời cho các trang chưa triển khai */
function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card empty">
        🚧 Màn hình đang được phát triển — Chặng tiếp theo của Sprint 1.
      </div>
    </>
  )
}

function NotFound() {
  return (
    <div className="card" style={{ maxWidth: 400, margin: '60px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>404</div>
      <h2 style={{ margin: '0 0 8px' }}>Trang không tồn tại</h2>
      <p style={{ color: '#718096', margin: '0 0 20px' }}>
        Đường dẫn bạn truy cập không hợp lệ.
      </p>
      <a href="/" className="btn btn-primary" style={{ display: 'inline-block' }}>
        Về trang chủ
      </a>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected: mọi user đã đăng nhập ─── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<ComingSoon title="Dashboard" />} />
              <Route path="profile" element={<ProfilePage />} />

              {/* Các trang chưa xây dựng (placeholder) */}
              <Route path="apartments" element={<ComingSoon title="Quản lý Căn hộ" />} />
              <Route path="households" element={<ComingSoon title="Quản lý Hộ gia đình" />} />
              <Route path="residents" element={<ComingSoon title="Quản lý Nhân khẩu" />} />
              <Route path="resident-histories" element={<ComingSoon title="Biến động Cư trú" />} />
              <Route path="fee-categories" element={<ComingSoon title="Danh mục Khoản thu" />} />
              <Route path="fee-collections" element={<ComingSoon title="Đợt thu" />} />
              <Route path="fee-charges" element={<ComingSoon title="Khoản phải thu / Công nợ" />} />
              <Route path="payments" element={<ComingSoon title="Ghi nhận Thanh toán" />} />
              <Route path="search" element={<ComingSoon title="Tra cứu" />} />

              {/* ── Admin only ── */}
              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="users" element={<ComingSoon title="Quản lý Tài khoản" />} />
              </Route>
            </Route>
          </Route>

          {/* ── Fallback ──────────────────────────── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
