/**
 * ProfilePage.tsx — /profile (nhân viên) và /portal/profile (cư dân) · PBI-023, PBI-024 / US-015
 *  - Mọi vai trò tự cập nhật họ tên, email (PUT /api/auth/me).
 *  - Đổi mật khẩu bắt buộc nhập mật khẩu hiện tại (POST /api/auth/change-password).
 */
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Feedback } from '../components/Feedback'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { changePassword, updateMe } from '../lib/authService'
import { errorMessage } from '../lib/errors'
import { ROLE_LABELS } from '../lib/format'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function passwordProblems(pw: string): string[] {
  const issues: string[] = []
  if (pw.length < 8) issues.push('ít nhất 8 ký tự')
  if (!/[A-Za-z]/.test(pw)) issues.push('có chữ cái')
  if (!/\d/.test(pw)) issues.push('có chữ số')
  return issues
}

export function ChangePasswordForm({ onDone }: { onDone?: () => void }) {
  const { setUser } = useAuth()
  const { toast } = useUI()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const problems = next ? passwordProblems(next) : []

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!current) return setError('Vui lòng nhập mật khẩu hiện tại.')
    if (problems.length) return setError(`Mật khẩu mới cần ${problems.join(', ')}.`)
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại.')
    if (next !== confirmPw) return setError('Xác nhận mật khẩu không khớp.')
    setSaving(true)
    try {
      const user = await changePassword({ currentPassword: current, newPassword: next })
      setUser(user)
      toast.success('Đổi mật khẩu thành công.')
      setCurrent('')
      setNext('')
      setConfirmPw('')
      onDone?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Feedback error={error} />
      <div className="field mb-16">
        <label htmlFor="pw-current">Mật khẩu hiện tại *</label>
        <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div className="field mb-16">
        <label htmlFor="pw-new">Mật khẩu mới *</label>
        <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <span className={`hint ${next && problems.length ? 'text-danger' : next ? 'text-success' : ''}`}>
          {next ? (problems.length ? `Cần ${problems.join(', ')}` : '✓ Mật khẩu hợp lệ') : 'Tối thiểu 8 ký tự, gồm cả chữ và số.'}
        </span>
      </div>
      <div className="field mb-20">
        <label htmlFor="pw-confirm">Nhập lại mật khẩu mới *</label>
        <input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        {confirmPw && confirmPw !== next && <span className="hint text-danger">Chưa khớp với mật khẩu mới.</span>}
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Đang lưu…' : 'Đổi mật khẩu'}
      </button>
    </form>
  )
}

export function ProfilePage() {
  const { user, setUser } = useAuth()
  const { toast } = useUI()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!fullName.trim()) return setError('Vui lòng nhập họ tên.')
    if (!EMAIL_RE.test(email.trim())) return setError('Email không hợp lệ.')
    setSaving(true)
    try {
      const updated = await updateMe({ fullName: fullName.trim(), email: email.trim() })
      setUser(updated)
      toast.success('Đã cập nhật thông tin cá nhân.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Hồ sơ cá nhân" description="Xem, cập nhật thông tin tài khoản và đổi mật khẩu." />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3 className="section-title">Thông tin tài khoản</h3>
          <dl className="detail-list mb-16">
            <dt>Tên đăng nhập</dt>
            <dd>{user.username}</dd>
            <dt>Vai trò</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
            {user.householdCode && (
              <>
                <dt>Hộ gia đình</dt>
                <dd>
                  {user.householdCode} · căn {user.apartmentCode}
                </dd>
              </>
            )}
          </dl>
          <Feedback error={error} />
          <form onSubmit={saveProfile} noValidate>
            <div className="field mb-16">
              <label htmlFor="p-name">Họ và tên *</label>
              <input id="p-name" maxLength={200} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field mb-20">
              <label htmlFor="p-email">Email *</label>
              <input id="p-email" type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu thông tin'}
            </button>
          </form>
        </div>
        <div className="card">
          <h3 className="section-title">Đổi mật khẩu</h3>
          <ChangePasswordForm />
        </div>
      </div>
    </>
  )
}
