/**
 * HouseholdsPage.tsx — /households (B2, PBI-001)
 * Phân trang & lọc phía server. Ban quản trị: CRUD + cấp tài khoản cổng cư dân (từng hộ / hàng loạt).
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { BuildingFilter, FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Feedback } from '../components/Feedback'
import { useListQuery } from '../hooks/useListQuery'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import { householdsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import { exportCsv, formatDate, todayInput } from '../lib/format'
import type { Household } from '../types/models'
import type { ProvisionedAccount } from '../types/auth'

interface FormState {
  householdCode: string
  apartmentId: number | null
  apartmentLabel?: string
  isActive: boolean
}
const EMPTY: FormState = { householdCode: '', apartmentId: null, isActive: true }
const FILTERS = ['q', 'building', 'isActive', 'hasAccount'] as const

export function HouseholdsPage() {
  const { toast, confirm } = useUI()
  const { isAdmin } = useAuth()
  const list = useListQuery(FILTERS, (p) => householdsApi.list(p))
  const { filters, setFilter } = list

  const [editing, setEditing] = useState<Household | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<ProvisionedAccount[] | null>(null)

  function openForm(h: Household | null) {
    setEditing(h)
    setForm(h ? { householdCode: h.householdCode, apartmentId: h.apartmentId, apartmentLabel: h.apartmentCode, isActive: h.isActive } : EMPTY)
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const householdCode = form.householdCode.trim().toUpperCase()
    if (!householdCode) return setFormError('Vui lòng nhập mã hộ.')
    if (householdCode.length > 50) return setFormError('Mã hộ tối đa 50 ký tự.')
    if (!form.apartmentId) return setFormError('Vui lòng chọn căn hộ.')

    if (editing && editing.isActive && !form.isActive) {
      const ok = await confirm(`Ngừng hoạt động hộ ${editing.householdCode}?`, {
        title: 'Ngừng hoạt động hộ gia đình',
        confirmText: 'Ngừng hoạt động',
        danger: true,
        warning: 'Căn hộ sẽ chuyển sang "Còn trống", tài khoản cư dân của hộ sẽ không đăng nhập được, và hộ không được tính khi lập danh sách phải thu.',
      })
      if (!ok) return
    }

    setSaving(true)
    setFormError(undefined)
    try {
      if (editing) {
        await householdsApi.update(editing.id, { householdCode, apartmentId: form.apartmentId, isActive: form.isActive })
        toast.success(`Đã cập nhật hộ ${householdCode}.`)
      } else {
        await householdsApi.create({ householdCode, apartmentId: form.apartmentId })
        toast.success(`Đã thêm hộ ${householdCode}.`)
      }
      setOpen(false)
      list.reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(h: Household) {
    const ok = await confirm(`Xóa hộ gia đình ${h.householdCode}?`, {
      title: 'Xóa hộ gia đình',
      danger: true,
      confirmText: 'Xóa',
      details: [
        ['Mã hộ', h.householdCode],
        ['Căn hộ', h.apartmentCode],
        ['Chủ hộ', h.headOfHousehold ?? '—'],
      ],
      warning: 'Chỉ xóa được hộ chưa có nhân khẩu và chưa được cấp tài khoản. Nếu hộ đã chuyển đi, hãy "Ngừng hoạt động" thay vì xóa.',
      onConfirm: () => householdsApi.remove(h.id),
    })
    if (ok) {
      toast.success(`Đã xóa hộ ${h.householdCode}.`)
      list.reload()
    }
  }

  async function provisionOne(h: Household) {
    let result: ProvisionedAccount | undefined
    const ok = await confirm(`Cấp tài khoản cổng cư dân cho hộ ${h.householdCode}?`, {
      title: 'Cấp tài khoản cư dân',
      confirmText: 'Cấp tài khoản',
      details: [
        ['Hộ / căn', `${h.householdCode} · ${h.apartmentCode}`],
        ['Chủ hộ', h.headOfHousehold ?? '—'],
        ['Tên đăng nhập', h.householdCode.toLowerCase()],
      ],
      warning: 'Mật khẩu tạm chỉ hiển thị MỘT lần. Cư dân phải đổi mật khẩu ở lần đăng nhập đầu tiên.',
      onConfirm: async () => {
        result = await householdsApi.provisionAccount(h.id)
      },
    })
    if (ok && result) {
      setAccounts([result])
      list.reload()
    }
  }

  async function provisionBulk() {
    let result: ProvisionedAccount[] = []
    const scope = filters.building ? `tòa ${filters.building}` : 'tất cả các tòa'
    const ok = await confirm(`Cấp tài khoản cổng cư dân cho mọi hộ đang hoạt động chưa có tài khoản (${scope})?`, {
      title: 'Cấp tài khoản hàng loạt',
      confirmText: 'Cấp tài khoản',
      warning: 'Danh sách mật khẩu tạm chỉ hiển thị MỘT lần — hãy tải file CSV để phát cho từng hộ.',
      onConfirm: async () => {
        result = await householdsApi.provisionAccounts(filters.building || undefined)
      },
    })
    if (!ok) return
    if (result.length === 0) toast.info('Tất cả hộ đang hoạt động đều đã có tài khoản.')
    else setAccounts(result)
    list.reload()
  }

  const columns: Column<Household>[] = [
    { key: 'code', header: 'Mã hộ', sortKey: 'code', render: (h) => <span className="fw-bold">{h.householdCode}</span> },
    { key: 'apt', header: 'Căn hộ', sortKey: 'apartment', render: (h) => h.apartmentCode },
    { key: 'building', header: 'Tòa', sortKey: 'building', render: (h) => h.building },
    {
      key: 'head',
      header: 'Chủ hộ',
      sortKey: 'head',
      render: (h) =>
        h.headOfHousehold ? (
          <>
            {h.headOfHousehold}
            {h.headPhoneNumber && <div className="text-muted small">{h.headPhoneNumber}</div>}
          </>
        ) : (
          <span className="text-warning">Chưa có chủ hộ</span>
        ),
    },
    { key: 'residents', header: 'Nhân khẩu', sortKey: 'residents', align: 'right', render: (h) => h.residentCount ?? 0 },
    {
      key: 'account',
      header: 'Tài khoản cư dân',
      render: (h) => (h.accountUsername ? <code>{h.accountUsername}</code> : <span className="text-muted">Chưa cấp</span>),
    },
    { key: 'created', header: 'Ngày tạo', sortKey: 'createdat', render: (h) => formatDate(h.createdAt) },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (h) => <StatusBadge value={h.isActive ? 'Active' : 'Inactive'} label={h.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (h) => (
        <div className="actions">
          <Link className="btn btn-ghost btn-sm" to={`/residents?householdId=${h.id}`}>
            Nhân khẩu
          </Link>
          {isAdmin && (
            <>
              {!h.accountUsername && h.isActive && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => provisionOne(h)}>
                  Cấp TK
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openForm(h)}>
                Sửa
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(h)}>
                Xóa
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Quản lý Hộ gia đình"
        description="Theo dõi các hộ đang sinh sống, chủ hộ, số nhân khẩu và tài khoản cổng cư dân."
        action={
          isAdmin && (
            <div className="btn-group">
              <button type="button" className="btn btn-secondary" onClick={provisionBulk}>
                👥 Cấp tài khoản hàng loạt
              </button>
              <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
                + Thêm hộ gia đình
              </button>
            </div>
          )
        }
      />

      <div className="card">
        <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
          <SearchInput id="hh-q" label="Mã hộ / mã căn / tên chủ hộ" value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="VD: HK-A0101, nguyen van an…" />
          <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
          <SelectFilter
            id="hh-active"
            label="Trạng thái"
            value={filters.isActive}
            onChange={(v) => setFilter('isActive', v)}
            options={[
              { value: 'true', label: 'Đang hoạt động' },
              { value: 'false', label: 'Ngừng hoạt động' },
            ]}
          />
          <SelectFilter
            id="hh-acc"
            label="Tài khoản cư dân"
            value={filters.hasAccount}
            onChange={(v) => setFilter('hasAccount', v)}
            options={[
              { value: 'true', label: 'Đã cấp' },
              { value: 'false', label: 'Chưa cấp' },
            ]}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(h) => h.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          rowClassName={(h) => (h.isActive ? undefined : 'row-muted')}
          emptyText="Không có hộ gia đình phù hợp."
        />
        {list.data && (
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />
        )}
      </div>

      <Modal
        open={open}
        title={editing ? `Sửa hộ ${editing.householdCode}` : 'Thêm hộ gia đình'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="household-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="household-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="f-hh-code">Mã hộ *</label>
            <input id="f-hh-code" maxLength={50} value={form.householdCode} onChange={(e) => setForm({ ...form, householdCode: e.target.value })} placeholder="VD: HK-A1201" autoFocus />
          </div>
          <AsyncCombobox
            kind="apartments"
            label="Căn hộ"
            required
            value={form.apartmentId}
            initialLabel={form.apartmentLabel}
            onChange={(item) => setForm({ ...form, apartmentId: item?.id ?? null, apartmentLabel: item?.label })}
            placeholder="Gõ mã căn hộ…"
          />
          {editing && (
            <label className="check span-2">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Hộ đang hoạt động (bỏ chọn khi cả hộ đã chuyển đi)
            </label>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(accounts)}
        size="lg"
        title={`Đã cấp ${accounts?.length ?? 0} tài khoản cư dân`}
        onClose={() => setAccounts(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                accounts &&
                exportCsv(
                  `tai-khoan-cu-dan-${todayInput()}.csv`,
                  ['Mã hộ', 'Căn hộ', 'Chủ hộ', 'Tên đăng nhập', 'Mật khẩu tạm'],
                  accounts.map((a) => [a.householdCode, a.apartmentCode, a.fullName, a.username, a.temporaryPassword]),
                )
              }
            >
              ⬇ Tải CSV
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAccounts(null)}>
              Đã lưu, đóng
            </button>
          </>
        }
      >
        <div className="alert alert-warning">
          ⚠️ Mật khẩu tạm chỉ hiển thị lần này. Hãy tải CSV hoặc ghi lại để gửi cho từng hộ. Cư dân sẽ phải đổi mật khẩu khi đăng nhập lần đầu.
        </div>
        <div className="table-wrap" style={{ maxHeight: 360 }}>
          <table>
            <thead>
              <tr>
                <th>Mã hộ</th>
                <th>Căn hộ</th>
                <th>Chủ hộ</th>
                <th>Tên đăng nhập</th>
                <th>Mật khẩu tạm</th>
              </tr>
            </thead>
            <tbody>
              {accounts?.map((a) => (
                <tr key={a.username}>
                  <td>{a.householdCode}</td>
                  <td>{a.apartmentCode}</td>
                  <td>{a.fullName}</td>
                  <td>
                    <code>{a.username}</code>
                  </td>
                  <td>
                    <code className="fw-bold">{a.temporaryPassword}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  )
}
