/**
 * ProfilePage.tsx
 * Trang Hồ sơ cá nhân — Route: /profile
 * - Xem thông tin user đang đăng nhập.
 * - Cập nhật fullName, email (không cho sửa role).
 * - Đổi mật khẩu (điền newPassword).
 *
 * ⚠ LƯU Ý: Backend dùng PUT /api/users/{id} với [Authorize(Roles="Admin")].
 * Role "User" (Kế toán) KHÔNG có quyền tự cập nhật thông tin.
 * Màn hình hiển thị cảnh báo tương ứng và ẩn form sửa đổi với role User.
 */
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Feedback } from '../components/Feedback'
import { useAuth } from '../context/AuthContext'
import { updateUser } from '../lib/authService'

export function ProfilePage() {
  const { user, isAdmin, login, token } = useAuth()

  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | undefined>()

  if (!user) return null

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(undefined)
    setSuccess(undefined)

    // Validate
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ tên.')
      return
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email.')
      return
    }
    if (newPassword && newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    setLoading(true)
    try {
      const updatedUser = await updateUser(user!.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        role: user!.role,
        ...(newPassword ? { newPassword } : {}),
      })

      // Cập nhật thông tin trong AuthContext & localStorage
      if (token) {
        login(token, updatedUser)
      }

      setSuccess('Cập nhật thông tin thành công.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Hồ sơ cá nhân"
        description="Xem và cập nhật thông tin tài khoản của bạn."
      />

      <div style={{ maxWidth: 560 }}>
        {/* Thông tin chỉ-đọc */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#52657d' }}>
            THÔNG TIN TÀI KHOẢN
          </h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <div style={{ fontSize: '.8rem', color: '#718096', marginBottom: 4 }}>Tên đăng nhập</div>
              <div style={{ fontWeight: 600 }}>{user.username}</div>
            </div>
            <div>
              <div style={{ fontSize: '.8rem', color: '#718096', marginBottom: 4 }}>Vai trò</div>
              <div style={{ fontWeight: 600 }}>
                {user.role === 'Admin' ? '🏢 Ban quản trị (Admin)' : '📊 Kế toán (User)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '.8rem', color: '#718096', marginBottom: 4 }}>Trạng thái</div>
              <div>
                <span className={`badge ${user.isActive ? 'badge-success' : 'badge-muted'}`}>
                  {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cảnh báo cho role User */}
        {!isAdmin && (
          <div
            className="alert"
            style={{
              background: '#fef3c7',
              color: '#92400e',
              marginBottom: 20,
              borderRadius: 9,
              padding: '12px 14px',
            }}
            role="note"
          >
            ⚠️ Tài khoản <strong>Kế toán (User)</strong> hiện không có quyền tự cập nhật thông tin.
            Vui lòng liên hệ <strong>Ban quản trị</strong> để thay đổi.
          </div>
        )}

        {/* Form chỉ hiển thị cho Admin */}
        {isAdmin && (
          <div className="card">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: '#52657d' }}>
              CẬP NHẬT THÔNG TIN
            </h3>

            <Feedback error={error} success={success} />

            <form onSubmit={handleSubmit} noValidate>
              <div className="field" style={{ marginBottom: 16 }}>
                <label htmlFor="fullName">Họ và tên</label>
                <input
                  id="fullName"
                  type="text"
                  maxLength={200}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: 24 }}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  maxLength={200}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e6ebf2', margin: '0 0 20px' }} />
              <p style={{ margin: '0 0 16px', fontSize: '.85rem', color: '#718096' }}>
                Để đổi mật khẩu, điền vào hai trường bên dưới. Bỏ trống nếu không muốn thay đổi.
              </p>

              <div className="field" style={{ marginBottom: 16 }}>
                <label htmlFor="newPassword">Mật khẩu mới</label>
                <input
                  id="newPassword"
                  type="password"
                  maxLength={200}
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="field" style={{ marginBottom: 24 }}>
                <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
                <input
                  id="confirmPassword"
                  type="password"
                  maxLength={200}
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFullName(user.fullName)
                    setEmail(user.email)
                    setNewPassword('')
                    setConfirmPassword('')
                    setError(undefined)
                    setSuccess(undefined)
                  }}
                  disabled={loading}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
