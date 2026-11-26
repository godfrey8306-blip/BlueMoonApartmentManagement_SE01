/**
 * ApartmentsPage.tsx — /apartments (B1, hỗ trợ PBI-001)
 * Phân trang & lọc phía server (tòa, tầng, trạng thái, mã căn / mã hộ). Ghi: chỉ Ban quản trị.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { BuildingFilter, FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Feedback } from '../components/Feedback'
import { useListQuery } from '../hooks/useListQuery'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import { apartmentsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import { APARTMENT_STATUS_LABELS, formatNumber, label } from '../lib/format'
import type { Apartment, ApartmentInput } from '../types/models'

const EMPTY: ApartmentInput = { apartmentCode: '', building: '', floor: 1, area: 0, status: 'Available' }
const FILTERS = ['q', 'building', 'floor', 'status'] as const

export function ApartmentsPage() {
  const { toast, confirm } = useUI()
  const { isAdmin } = useAuth()
  const list = useListQuery(FILTERS, (p) => apartmentsApi.list(p), { defaultSort: '' })
  const { filters, setFilter } = list

  const [editing, setEditing] = useState<Apartment | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ApartmentInput>(EMPTY)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function openForm(a: Apartment | null) {
    setEditing(a)
    setForm(a ? { apartmentCode: a.apartmentCode, building: a.building, floor: a.floor, area: a.area, status: a.status } : EMPTY)
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload = { ...form, apartmentCode: form.apartmentCode.trim(), building: form.building.trim().toUpperCase() }
    if (!payload.apartmentCode) return setFormError('Vui lòng nhập mã căn hộ.')
    if (!payload.building) return setFormError('Vui lòng nhập tòa nhà.')
    if (!Number.isInteger(payload.floor) || payload.floor < 1 || payload.floor > 100)
      return setFormError('Tầng phải là số nguyên từ 1 đến 100.')
    if (!(payload.area >= 0.1 && payload.area <= 10000)) return setFormError('Diện tích phải từ 0,1 đến 10.000 m².')

    setSaving(true)
    setFormError(undefined)
    try {
      if (editing) {
        await apartmentsApi.update(editing.id, payload)
        toast.success(`Đã cập nhật căn hộ ${payload.apartmentCode}.`)
      } else {
        await apartmentsApi.create(payload)
        toast.success(`Đã thêm căn hộ ${payload.apartmentCode}.`)
      }
      setOpen(false)
      list.reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(a: Apartment) {
    const ok = await confirm(`Xóa căn hộ ${a.apartmentCode}?`, {
      title: 'Xóa căn hộ',
      danger: true,
      confirmText: 'Xóa căn hộ',
      details: [
        ['Mã căn hộ', a.apartmentCode],
        ['Tòa / tầng', `${a.building} / ${a.floor}`],
        ['Diện tích', `${formatNumber(a.area)} m²`],
      ],
      warning: 'Thao tác không thể hoàn tác. Căn hộ đã có hộ gia đình hoặc khoản thu sẽ không xóa được.',
      onConfirm: () => apartmentsApi.remove(a.id),
    })
    if (ok) {
      toast.success(`Đã xóa căn hộ ${a.apartmentCode}.`)
      list.reload()
    }
  }

  const columns: Column<Apartment>[] = [
    { key: 'code', header: 'Mã căn hộ', sortKey: 'code', render: (a) => <span className="fw-bold">{a.apartmentCode}</span> },
    { key: 'building', header: 'Tòa', sortKey: 'building', render: (a) => a.building },
    { key: 'floor', header: 'Tầng', sortKey: 'floor', align: 'right', render: (a) => a.floor },
    { key: 'area', header: 'Diện tích (m²)', sortKey: 'area', align: 'right', render: (a) => formatNumber(a.area) },
    {
      key: 'household',
      header: 'Hộ đang ở',
      render: (a) =>
        a.householdCode ? (
          <Link to={`/households?q=${encodeURIComponent(a.householdCode)}`}>{a.householdCode}</Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'residents', header: 'Nhân khẩu', sortKey: 'residents', align: 'right', render: (a) => a.residentCount ?? 0 },
    {
      key: 'status',
      header: 'Trạng thái',
      sortKey: 'status',
      render: (a) => <StatusBadge value={a.status} label={label(APARTMENT_STATUS_LABELS, a.status)} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div className="actions">
          <Link className="btn btn-ghost btn-sm" to={`/fee-charges?q=${encodeURIComponent(a.apartmentCode)}`}>
            Công nợ
          </Link>
          {isAdmin && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openForm(a)}>
                Sửa
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(a)}>
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
        title="Quản lý Căn hộ"
        description="Danh sách căn hộ của tất cả các tòa trong chung cư BlueMoon."
        action={
          isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
              + Thêm căn hộ
            </button>
          )
        }
      />

      <div className="card">
        <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
          <SearchInput id="apt-q" label="Mã căn hộ / mã hộ" value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="VD: A-0101, HK-B12…" />
          <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
          <div className="field" style={{ minWidth: 100 }}>
            <label htmlFor="apt-floor">Tầng</label>
            <input id="apt-floor" type="number" min={1} max={100} value={filters.floor} onChange={(e) => setFilter('floor', e.target.value)} />
          </div>
          <SelectFilter
            id="apt-status"
            label="Trạng thái"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(APARTMENT_STATUS_LABELS).map(([value, l]) => ({ value, label: l }))}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(a) => a.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          emptyText={list.activeFilterCount ? 'Không tìm thấy căn hộ phù hợp với bộ lọc.' : 'Chưa có căn hộ nào.'}
        />
        {list.data && (
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />
        )}
      </div>

      <Modal
        open={open}
        title={editing ? `Sửa căn hộ ${editing.apartmentCode}` : 'Thêm căn hộ'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="apartment-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="apartment-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="f-code">Mã căn hộ *</label>
            <input id="f-code" value={form.apartmentCode} onChange={(e) => setForm({ ...form, apartmentCode: e.target.value })} placeholder="VD: A-1201" autoFocus />
          </div>
          <div className="field">
            <label htmlFor="f-building">Tòa nhà *</label>
            <input id="f-building" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="VD: A" />
          </div>
          <div className="field">
            <label htmlFor="f-floor">Tầng * (1–100)</label>
            <input id="f-floor" type="number" min={1} max={100} value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="f-area">Diện tích (m²) *</label>
            <input id="f-area" type="number" min={0.1} max={10000} step="0.1" value={form.area} onChange={(e) => setForm({ ...form, area: Number(e.target.value) })} />
          </div>
          <div className="field span-2">
            <label htmlFor="f-status">Trạng thái</label>
            <select id="f-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(APARTMENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <span className="hint">Trạng thái "Đang ở" / "Còn trống" tự cập nhật khi thêm hoặc ngừng hộ gia đình.</span>
          </div>
        </form>
      </Modal>
    </>
  )
}
