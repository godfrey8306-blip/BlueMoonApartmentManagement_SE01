/**
 * UsersPage.tsx — /users (A3 · PBI-026 / US-016) — Ban quản trị
 * Vai trò: Admin (Ban quản trị) · User (Kế toán) · Resident (Cư dân — gắn với một hộ).
 */
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Feedback } from '../components/Feedback'
import { useListQuery } from '../hooks/useListQuery'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import { createUser, getUsers, lockUser, unlockUser, updateUser } from '../lib/authService'
import { errorMessage } from '../lib/errors'
import { ROLE_LABELS } from '../lib/format'
import type { Role, UserResponse } from '../types/auth'

interface FormState {
  username: string
  password: string
  fullName: string
  email: string
  role: Role
  householdId: number | null
  householdLabel?: string
}
const EMPTY: FormState = { username: '', password: '', fullName: '', email: '', role: 'User', householdId: null }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Admin: 'Toàn quyền: cư dân, biến động, thu phí, tài khoản.',
  User: 'Thu phí, công nợ, thanh toán, thống kê; chỉ xem dữ liệu cư dân.',
  Resident: 'Chỉ đăng nhập cổng cư dân, xem phí và thông báo của hộ mình.',
}

export function UsersPage() {
  const { toast, confirm } = useUI()
  const { user: me, setUser } = useAuth()
  const list = useListQuery(['q', 'role', 'isActive'] as const, (p) => getUsers(p))
  const { filters, setFilter } = list

  const [editing, setEditing] = useState<UserResponse | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function openForm(u: UserResponse | null) {
    setEditing(u)
    setForm(
      u
        ? { username: u.username, password: '', fullName: u.fullName, email: u.email, role: u.role, householdId: u.householdId ?? null, householdLabel: u.householdCode ?? undefined }
        : EMPTY,
    )
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fullName = form.fullName.trim()
    const email = form.email.trim()
    if (!editing) {
      if (form.username.trim().length < 3) return setFormError('Tên đăng nhập tối thiểu 3 ký tự.')
      if (form.password.length < 8) return setFormError('Mật khẩu tối thiểu 8 ký tự.')
    } else if (form.password && form.password.length < 8) {
      return setFormError('Mật khẩu mới tối thiểu 8 ký tự.')
    }
    if (!fullName) return setFormError('Vui lòng nhập họ tên.')
    if (!EMAIL_RE.test(email)) return setFormError('Email không hợp lệ.')
    if (form.role === 'Resident' && !form.householdId) return setFormError('Tài khoản cư dân phải gắn với một hộ gia đình.')
    setFormError(undefined)

    const roleChanged = editing && editing.role !== form.role
    if (roleChanged || (editing && form.password)) {
      const ok = await confirm(`Cập nhật tài khoản ${editing!.username}?`, {
        title: 'Xác nhận thay đổi tài khoản',
        confirmText: 'Lưu thay đổi',
        danger: Boolean(roleChanged && editing!.role === 'Admin'),
        details: [
          ...(roleChanged ? ([['Vai trò', `${ROLE_LABELS[editing!.role]} → ${ROLE_LABELS[form.role]}`]] as [string, string][]) : []),
          ...(form.password ? ([['Mật khẩu', 'Đặt lại (người dùng phải đổi khi đăng nhập)']] as [string, string][]) : []),
        ],
        warning: roleChanged ? `Quyền mới: ${ROLE_DESCRIPTIONS[form.role]} Có hiệu lực từ lần đăng nhập tiếp theo.` : undefined,
      })
      if (!ok) return
    }

    setSaving(true)
    try {
      if (editing) {
        const updated = await updateUser(editing.id, {
          fullName,
          email,
          role: form.role,
          householdId: form.role === 'Resident' ? form.householdId : null,
          ...(form.password ? { newPassword: form.password } : {}),
        })
        if (updated.id === me?.id) setUser(updated)
        toast.success(`Đã cập nhật tài khoản ${editing.username}.`)
      } else {
        await createUser({ username: form.username.trim(), password: form.password, fullName, email, role: form.role, householdId: form.role === 'Resident' ? form.householdId : null })
        toast.success(`Đã tạo tài khoản ${form.username.trim()}.`)
      }
      setOpen(false)
      list.reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleLock(u: UserResponse) {
    const locking = u.isActive
    const ok = await confirm(`${locking ? 'Khóa' : 'Mở khóa'} tài khoản "${u.username}"?`, {
      title: locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      danger: locking,
      confirmText: locking ? 'Khóa tài khoản' : 'Mở khóa',
      details: [
        ['Tài khoản', `${u.username} — ${u.fullName}`],
        ['Vai trò', ROLE_LABELS[u.role]],
      ],
      requireText: locking && u.role === 'Admin' ? u.username : undefined,
      warning: locking ? 'Người dùng sẽ không thể đăng nhập cho tới khi được mở khóa.' : undefined,
      onConfirm: () => (locking ? lockUser(u.id) : unlockUser(u.id)),
    })
    if (!ok) return
    toast.success(`Đã ${locking ? 'khóa' : 'mở khóa'} tài khoản ${u.username}.`)
    list.reload()
  }

  const columns: Column<UserResponse>[] = [
    {
      key: 'username',
      header: 'Tên đăng nhập',
      sortKey: 'username',
      render: (u) => (
        <>
          <span className="fw-bold">{u.username}</span>
          {u.id === me?.id && <span className="text-muted"> (bạn)</span>}
          {u.mustChangePassword && <div className="text-muted small">Chưa đổi mật khẩu tạm</div>}
        </>
      ),
    },
    { key: 'name', header: 'Họ tên', sortKey: 'fullname', render: (u) => u.fullName },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Vai trò',
      sortKey: 'role',
      render: (u) => <StatusBadge value={u.role} label={ROLE_LABELS[u.role]} tone={u.role === 'Admin' ? 'info' : u.role === 'User' ? 'success' : 'muted'} />,
    },
    { key: 'hh', header: 'Hộ / căn', render: (u) => (u.householdCode ? `${u.householdCode} · ${u.apartmentCode}` : '—') },
    { key: 'status', header: 'Trạng thái', render: (u) => <StatusBadge value={u.isActive ? 'Active' : 'Locked'} label={u.isActive ? 'Đang hoạt động' : 'Đã khóa'} /> },
    {
      key: 'a',
      header: '',
      align: 'right',
      render: (u) => (
        <div className="actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openForm(u)}>
            Sửa / phân quyền
          </button>
          {u.id !== me?.id && (
            <button type="button" className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggleLock(u)}>
              {u.isActive ? 'Khóa' : 'Mở khóa'}
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Tài khoản & Phân quyền"
        description="Quản lý tài khoản Ban quản trị, Kế toán và tài khoản cổng cư dân."
        action={
          <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
            + Tạo tài khoản
          </button>
        }
      />
      <div className="card">
        <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
          <SearchInput id="u-q" label="Tên đăng nhập / họ tên / email / mã hộ" value={filters.q} onChange={(v) => setFilter('q', v)} />
          <SelectFilter
            id="u-role"
            label="Vai trò"
            value={filters.role}
            onChange={(v) => setFilter('role', v)}
            options={(Object.keys(ROLE_DESCRIPTIONS) as Role[]).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
          <SelectFilter
            id="u-active"
            label="Trạng thái"
            value={filters.isActive}
            onChange={(v) => setFilter('isActive', v)}
            options={[
              { value: 'true', label: 'Đang hoạt động' },
              { value: 'false', label: 'Đã khóa' },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(u) => u.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          rowClassName={(u) => (u.isActive ? undefined : 'row-muted')}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>

      <Modal
        open={open}
        title={editing ? `Sửa tài khoản: ${editing.username}` : 'Tạo tài khoản'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="user-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="f-u-name">Tên đăng nhập *</label>
            <input id="f-u-name" maxLength={100} value={form.username} disabled={Boolean(editing)} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="f-u-pass">{editing ? 'Đặt lại mật khẩu (bỏ trống nếu giữ nguyên)' : 'Mật khẩu *'}</label>
            <input id="f-u-pass" type="password" maxLength={200} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" placeholder="Tối thiểu 8 ký tự" />
          </div>
          <div className="field">
            <label htmlFor="f-u-full">Họ tên *</label>
            <input id="f-u-full" maxLength={200} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-u-email">Email *</label>
            <input id="f-u-email" type="email" maxLength={320} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field span-2">
            <label htmlFor="f-u-role">Vai trò *</label>
            <select id="f-u-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} disabled={editing?.id === me?.id}>
              {(Object.keys(ROLE_DESCRIPTIONS) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]} ({r})
                </option>
              ))}
            </select>
            <span className="hint">{ROLE_DESCRIPTIONS[form.role]}</span>
          </div>
          {form.role === 'Resident' && (
            <AsyncCombobox
              kind="households"
              label="Hộ gia đình"
              required
              className="span-2"
              value={form.householdId}
              initialLabel={form.householdLabel}
              params={{ isActive: true }}
              onChange={(i) => setForm({ ...form, householdId: i?.id ?? null, householdLabel: i?.label })}
            />
          )}
        </form>
      </Modal>
    </>
  )
}
