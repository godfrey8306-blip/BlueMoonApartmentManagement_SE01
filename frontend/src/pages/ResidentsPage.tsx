/**
 * ResidentsPage.tsx — /residents (B3, PBI-002; tra cứu PBI-005; báo cáo cư dân PBI-021)
 * Tìm kiếm không dấu theo họ tên / CCCD / SĐT / mã hộ / mã căn; lọc tòa, tình trạng, giới tính, độ tuổi.
 * Xuất CSV toàn bộ kết quả lọc (tải lần lượt từng trang). Ghi: chỉ Ban quản trị.
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
import { useAsync } from '../hooks/useAsync'
import { useUI } from '../context/UIContext'
import { useAuth } from '../context/AuthContext'
import { fetchAllPages, householdsApi, residentsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import {
  GENDER_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RESIDENT_STATUS_LABELS,
  ageOf,
  dateInputToIso,
  exportCsv,
  formatDate,
  isoDatePart,
  label,
  todayInput,
} from '../lib/format'
import type { Resident, ResidentInput } from '../types/models'

interface FormState {
  householdId: number | null
  householdLabel?: string
  fullName: string
  identityNumber: string
  dateOfBirth: string
  gender: string
  phoneNumber: string
  relationship: string
  isHouseholdHead: boolean
  status: string
}
const EMPTY: FormState = {
  householdId: null,
  fullName: '',
  identityNumber: '',
  dateOfBirth: '',
  gender: '',
  phoneNumber: '',
  relationship: '',
  isHouseholdHead: false,
  status: 'Active',
}
const FILTERS = ['q', 'householdId', 'building', 'status', 'gender', 'isHouseholdHead', 'ageFrom', 'ageTo'] as const

export function ResidentsPage() {
  const { toast, confirm } = useUI()
  const { isAdmin } = useAuth()
  const list = useListQuery(FILTERS, (p) => residentsApi.list(p))
  const { filters, setFilter } = list

  const household = useAsync(() => householdsApi.get(Number(filters.householdId)), [filters.householdId], Boolean(filters.householdId))

  const [editing, setEditing] = useState<Resident | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<string>()

  function openForm(r: Resident | null) {
    setEditing(r)
    setForm(
      r
        ? {
            householdId: r.householdId,
            householdLabel: r.householdCode,
            fullName: r.fullName,
            identityNumber: r.identityNumber,
            dateOfBirth: isoDatePart(r.dateOfBirth),
            gender: r.gender,
            phoneNumber: r.phoneNumber,
            relationship: r.relationship,
            isHouseholdHead: r.isHouseholdHead,
            status: r.status || 'Active',
          }
        : {
            ...EMPTY,
            householdId: filters.householdId ? Number(filters.householdId) : null,
            householdLabel: household.data?.householdCode,
          },
    )
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const payload: ResidentInput = {
      householdId: form.householdId ?? 0,
      fullName: form.fullName.trim().replace(/\s+/g, ' '),
      identityNumber: form.identityNumber.trim(),
      dateOfBirth: dateInputToIso(form.dateOfBirth),
      gender: form.gender.trim(),
      phoneNumber: form.phoneNumber.trim(),
      relationship: form.relationship.trim(),
      isHouseholdHead: form.isHouseholdHead,
      status: form.status.trim() || 'Active',
    }
    if (!payload.householdId) return setFormError('Vui lòng chọn hộ gia đình.')
    if (!payload.fullName) return setFormError('Vui lòng nhập họ tên.')
    if (!/^\d{9}$|^\d{12}$/.test(payload.identityNumber)) return setFormError('Số CCCD phải gồm 12 chữ số (hoặc CMND 9 chữ số).')
    if (form.dateOfBirth && form.dateOfBirth > todayInput()) return setFormError('Ngày sinh không được ở tương lai.')
    if (payload.phoneNumber && !/^0\d{9,10}$/.test(payload.phoneNumber.replace(/[\s.-]/g, '')))
      return setFormError('Số điện thoại không hợp lệ (10–11 chữ số, bắt đầu bằng 0).')

    setSaving(true)
    setFormError(undefined)
    try {
      if (editing) {
        await residentsApi.update(editing.id, payload)
        toast.success(`Đã cập nhật nhân khẩu ${payload.fullName}.`)
      } else {
        await residentsApi.create(payload)
        toast.success(`Đã thêm nhân khẩu ${payload.fullName}.`)
      }
      setOpen(false)
      list.reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(r: Resident) {
    const ok = await confirm(`Xóa nhân khẩu ${r.fullName}?`, {
      title: 'Xóa nhân khẩu',
      danger: true,
      confirmText: 'Xóa',
      details: [
        ['Họ tên', r.fullName],
        ['CCCD', r.identityNumber],
        ['Hộ / căn', `${r.householdCode} · ${r.apartmentCode}`],
      ],
      warning: 'Chỉ xóa được nhân khẩu nhập nhầm (chưa có lịch sử cư trú/thanh toán). Người chuyển đi hãy ghi nhận "Chuyển đi" ở Biến động cư trú.',
      onConfirm: () => residentsApi.remove(r.id),
    })
    if (ok) {
      toast.success(`Đã xóa nhân khẩu ${r.fullName}.`)
      list.reload()
    }
  }

  async function handleExport() {
    setExporting('Đang tải…')
    try {
      const all = await fetchAllPages<Resident>('/residents', list.params, (n, t) => setExporting(`Đang tải ${n}/${t}…`))
      exportCsv(
        `bao-cao-cu-dan-${todayInput()}.csv`,
        ['Họ tên', 'CCCD', 'Ngày sinh', 'Tuổi', 'Giới tính', 'SĐT', 'Quan hệ', 'Chủ hộ', 'Mã hộ', 'Căn hộ', 'Tòa', 'Tình trạng cư trú'],
        all.map((r) => [
          r.fullName,
          r.identityNumber,
          formatDate(r.dateOfBirth),
          ageOf(r.dateOfBirth) ?? '',
          r.gender,
          r.phoneNumber,
          r.relationship,
          r.isHouseholdHead ? 'Có' : '',
          r.householdCode,
          r.apartmentCode,
          r.building,
          label(RESIDENT_STATUS_LABELS, r.status),
        ]),
      )
      toast.success(`Đã xuất ${all.length} nhân khẩu.`)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(undefined)
    }
  }

  const columns: Column<Resident>[] = [
    {
      key: 'name',
      header: 'Họ tên',
      sortKey: 'name',
      render: (r) => (
        <>
          <span className="fw-bold">{r.fullName}</span>
          {r.isHouseholdHead && (
            <span className="badge badge-info" style={{ marginLeft: 6 }}>
              Chủ hộ
            </span>
          )}
        </>
      ),
    },
    { key: 'cccd', header: 'CCCD', render: (r) => r.identityNumber },
    {
      key: 'dob',
      header: 'Ngày sinh',
      sortKey: 'dob',
      render: (r) => (
        <>
          {formatDate(r.dateOfBirth)} {ageOf(r.dateOfBirth) !== null && <span className="text-muted small">({ageOf(r.dateOfBirth)} t)</span>}
        </>
      ),
    },
    { key: 'gender', header: 'Giới tính', render: (r) => r.gender || '—' },
    { key: 'phone', header: 'SĐT', render: (r) => r.phoneNumber || '—' },
    { key: 'rel', header: 'Quan hệ', render: (r) => r.relationship || '—' },
    { key: 'hh', header: 'Mã hộ', sortKey: 'household', render: (r) => <Link to={`/residents?householdId=${r.householdId}`}>{r.householdCode}</Link> },
    { key: 'apt', header: 'Căn hộ', sortKey: 'apartment', render: (r) => r.apartmentCode },
    { key: 'status', header: 'Tình trạng', sortKey: 'status', render: (r) => <StatusBadge value={r.status} label={label(RESIDENT_STATUS_LABELS, r.status)} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) => (
        <div className="actions">
          {isAdmin && (
            <>
              <Link className="btn btn-ghost btn-sm" to={`/resident-histories?residentId=${r.id}`}>
                Biến động
              </Link>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openForm(r)}>
                Sửa
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>
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
        title="Quản lý Nhân khẩu"
        description={
          household.data
            ? `Nhân khẩu thuộc hộ ${household.data.householdCode} (căn ${household.data.apartmentCode}, chủ hộ ${household.data.headOfHousehold ?? '—'}).`
            : 'Tra cứu và quản lý nhân khẩu của tất cả các tòa.'
        }
        action={
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={!!exporting || !list.data?.total}>
              {exporting ?? '⬇ Xuất báo cáo CSV'}
            </button>
            {isAdmin && (
              <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
                + Thêm nhân khẩu
              </button>
            )}
          </div>
        }
      />

      <div className="card">
        <FilterBar
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
          advanced={
            <>
              <SelectFilter
                id="rs-gender"
                label="Giới tính"
                value={filters.gender}
                onChange={(v) => setFilter('gender', v)}
                options={GENDER_OPTIONS.map((g) => ({ value: g, label: g }))}
              />
              <SelectFilter
                id="rs-head"
                label="Vai trò trong hộ"
                value={filters.isHouseholdHead}
                onChange={(v) => setFilter('isHouseholdHead', v)}
                options={[
                  { value: 'true', label: 'Chủ hộ' },
                  { value: 'false', label: 'Thành viên' },
                ]}
              />
              <div className="field" style={{ minWidth: 110 }}>
                <label htmlFor="rs-age-from">Tuổi từ</label>
                <input id="rs-age-from" type="number" min={0} max={120} value={filters.ageFrom} onChange={(e) => setFilter('ageFrom', e.target.value)} />
              </div>
              <div className="field" style={{ minWidth: 110 }}>
                <label htmlFor="rs-age-to">đến</label>
                <input id="rs-age-to" type="number" min={0} max={120} value={filters.ageTo} onChange={(e) => setFilter('ageTo', e.target.value)} />
              </div>
              <AsyncCombobox
                kind="households"
                label="Hộ gia đình"
                value={filters.householdId ? Number(filters.householdId) : null}
                onChange={(item) => setFilter('householdId', item ? String(item.id) : '')}
                placeholder="Gõ mã hộ / tên chủ hộ…"
              />
            </>
          }
        >
          <SearchInput
            id="rs-q"
            label="Họ tên (không dấu) / CCCD / SĐT / mã hộ / mã căn"
            value={filters.q}
            onChange={(v) => setFilter('q', v)}
            placeholder="VD: nguyen van an, 0010800…, 0912…"
          />
          <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
          <SelectFilter
            id="rs-status"
            label="Tình trạng cư trú"
            value={filters.status}
            onChange={(v) => setFilter('status', v)}
            options={Object.entries(RESIDENT_STATUS_LABELS).map(([value, l]) => ({ value, label: l }))}
          />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(r) => r.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          rowClassName={(r) => (r.status === 'MovedOut' ? 'row-muted' : undefined)}
          emptyText="Không tìm thấy nhân khẩu phù hợp."
        />
        {list.data && (
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />
        )}
      </div>

      <Modal
        open={open}
        size="lg"
        title={editing ? `Sửa nhân khẩu: ${editing.fullName}` : 'Thêm nhân khẩu'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="resident-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="resident-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <AsyncCombobox
            kind="households"
            label="Hộ gia đình"
            required
            value={form.householdId}
            initialLabel={form.householdLabel}
            params={{ isActive: true }}
            onChange={(item) => setForm({ ...form, householdId: item?.id ?? null, householdLabel: item?.label })}
            placeholder="Gõ mã hộ / mã căn / tên chủ hộ…"
          />
          <div className="field">
            <label htmlFor="f-rs-name">Họ và tên *</label>
            <input id="f-rs-name" maxLength={200} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-rs-id">Số CCCD *</label>
            <input id="f-rs-id" inputMode="numeric" maxLength={12} value={form.identityNumber} onChange={(e) => setForm({ ...form, identityNumber: e.target.value.replace(/\D/g, '') })} placeholder="12 chữ số" />
          </div>
          <div className="field">
            <label htmlFor="f-rs-dob">Ngày sinh</label>
            <input id="f-rs-dob" type="date" max={todayInput()} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-rs-gender">Giới tính</label>
            <select id="f-rs-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">— Chọn —</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-rs-phone">Số điện thoại</label>
            <input id="f-rs-phone" inputMode="tel" maxLength={15} value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-rs-rel">Quan hệ với chủ hộ</label>
            <input id="f-rs-rel" list="relationship-options" maxLength={50} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
            <datalist id="relationship-options">
              {RELATIONSHIP_OPTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="f-rs-status">Tình trạng cư trú</label>
            <select id="f-rs-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!!editing}>
              {Object.entries(RESIDENT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {editing && <span className="hint">Đổi tình trạng qua màn hình Biến động cư trú để lưu lịch sử.</span>}
          </div>
          <label className="check span-2">
            <input
              type="checkbox"
              checked={form.isHouseholdHead}
              onChange={(e) =>
                setForm({ ...form, isHouseholdHead: e.target.checked, relationship: e.target.checked && !form.relationship ? 'Chủ hộ' : form.relationship })
              }
            />
            Là chủ hộ (mỗi hộ chỉ có một chủ hộ)
          </label>
        </form>
      </Modal>
    </>
  )
}
