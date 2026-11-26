/**
 * ResidentHistoriesPage.tsx — /resident-histories (B4, PBI-003, PBI-004 / US-004) — Ban quản trị
 * Loại biến động: Chuyển đến, Chuyển đi, Tạm trú, Tạm vắng, Thay đổi thông tin.
 * Backend tự cập nhật tình trạng cư trú của nhân khẩu trong cùng giao dịch.
 */
import { useState, type FormEvent } from 'react'
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
import { residentHistoriesApi, residentsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import { HISTORY_TYPE_LABELS, RESIDENT_STATUS_LABELS, dateInputToIso, formatDate, label, todayInput } from '../lib/format'
import type { HistoryType, ResidentHistory } from '../types/models'

const TYPE_TONE: Record<HistoryType, 'success' | 'danger' | 'info' | 'warning'> = {
  MoveIn: 'success',
  MoveOut: 'danger',
  TemporaryResidence: 'info',
  TemporaryAbsence: 'warning',
  InformationChange: 'info',
}
const STATUS_AFTER: Partial<Record<HistoryType, string>> = {
  MoveIn: 'Active',
  MoveOut: 'MovedOut',
  TemporaryResidence: 'TemporaryResident',
  TemporaryAbsence: 'TemporarilyAbsent',
}

interface FormState {
  residentId: number | null
  residentLabel?: string
  type: HistoryType
  startDate: string
  endDate: string
  destination: string
  note: string
  previousValue: string
  newValue: string
}
const FILTERS = ['q', 'residentId', 'historyType', 'fromDate', 'toDate', 'building'] as const

export function ResidentHistoriesPage() {
  const { toast, confirm } = useUI()
  const list = useListQuery(FILTERS, (p) =>
    residentHistoriesApi.list({
      ...p,
      fromDate: p.fromDate ? dateInputToIso(String(p.fromDate)) : undefined,
      toDate: p.toDate ? dateInputToIso(String(p.toDate)) : undefined,
    }),
  )
  const { filters, setFilter } = list
  const resident = useAsync(() => residentsApi.get(Number(filters.residentId)), [filters.residentId], Boolean(filters.residentId))

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>({ residentId: null, type: 'MoveIn', startDate: todayInput(), endDate: '', destination: '', note: '', previousValue: '', newValue: '' })
  const [formError, setFormError] = useState<string>()
  const [detail, setDetail] = useState<ResidentHistory | null>(null)

  function openCreate() {
    setForm({
      residentId: filters.residentId ? Number(filters.residentId) : null,
      residentLabel: resident.data?.fullName,
      type: 'TemporaryAbsence',
      startDate: todayInput(),
      endDate: '',
      destination: '',
      note: '',
      previousValue: '',
      newValue: '',
    })
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.residentId) return setFormError('Vui lòng chọn nhân khẩu.')
    if (!form.startDate) return setFormError('Vui lòng nhập ngày bắt đầu / ngày biến động.')
    if (form.endDate && form.endDate < form.startDate) return setFormError('Ngày kết thúc không được trước ngày bắt đầu.')
    if ((form.type === 'TemporaryAbsence' || form.type === 'TemporaryResidence') && !form.endDate)
      return setFormError('Tạm trú / tạm vắng cần có ngày kết thúc dự kiến.')
    if (!form.note.trim()) return setFormError('Vui lòng nhập ghi chú / lý do.')
    if (form.type === 'InformationChange' && (!form.previousValue.trim() || !form.newValue.trim()))
      return setFormError('Cần nhập giá trị cũ và giá trị mới khi thay đổi thông tin.')

    const statusAfter = STATUS_AFTER[form.type]
    setFormError(undefined)
    const ok = await confirm('Kiểm tra lại thông tin biến động cư trú trước khi lưu:', {
      title: 'Xác nhận ghi nhận biến động',
      confirmText: 'Ghi nhận',
      details: [
        ['Nhân khẩu', form.residentLabel ?? `#${form.residentId}`],
        ['Loại biến động', label(HISTORY_TYPE_LABELS, form.type)],
        ['Từ ngày', formatDate(form.startDate)],
        ...(form.endDate ? ([['Đến ngày', formatDate(form.endDate)]] as [string, string][]) : []),
        ...(form.destination ? ([['Nơi đến / đi', form.destination]] as [string, string][]) : []),
        ...(statusAfter ? ([['Tình trạng sau khi lưu', label(RESIDENT_STATUS_LABELS, statusAfter)]] as [string, string][]) : []),
      ],
      warning: 'Biến động cư trú là hồ sơ pháp lý, không sửa/xóa được sau khi lưu.',
      onConfirm: () =>
        residentHistoriesApi.create({
          residentId: form.residentId!,
          historyType: form.type,
          startDate: dateInputToIso(form.startDate)!,
          endDate: dateInputToIso(form.endDate),
          destination: form.destination.trim() || null,
          note: form.note.trim(),
          previousValue: form.type === 'InformationChange' ? form.previousValue.trim() : null,
          newValue: form.type === 'InformationChange' ? form.newValue.trim() : null,
        }),
    })
    if (!ok) return
    toast.success(`Đã ghi nhận "${label(HISTORY_TYPE_LABELS, form.type)}"${statusAfter ? ` — tình trạng: ${label(RESIDENT_STATUS_LABELS, statusAfter)}` : ''}.`)
    setOpen(false)
    list.reload()
  }

  const columns: Column<ResidentHistory>[] = [
    { key: 'name', header: 'Nhân khẩu', render: (h) => <span className="fw-bold">{h.residentFullName}</span> },
    { key: 'hh', header: 'Hộ / căn', render: (h) => `${h.householdCode} · ${h.apartmentCode}` },
    {
      key: 'type',
      header: 'Loại biến động',
      render: (h) => <StatusBadge value={h.historyType} label={label(HISTORY_TYPE_LABELS, h.historyType)} tone={TYPE_TONE[h.historyType]} />,
    },
    { key: 'start', header: 'Từ ngày', render: (h) => formatDate(h.startDate) },
    { key: 'end', header: 'Đến ngày', render: (h) => formatDate(h.endDate) },
    { key: 'dest', header: 'Nơi đến / đi', render: (h) => h.destination || '—' },
    { key: 'note', header: 'Ghi chú', className: 'wrap', render: (h) => h.note },
    {
      key: 'a',
      header: '',
      align: 'right',
      render: (h) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(h)}>
          Chi tiết
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Biến động Cư trú"
        description={
          resident.data
            ? `Lịch sử cư trú của ${resident.data.fullName} (hộ ${resident.data.householdCode}) — hiện: ${label(RESIDENT_STATUS_LABELS, resident.data.status)}.`
            : 'Ghi nhận chuyển đến, chuyển đi, tạm trú, tạm vắng và thay đổi thông tin nhân khẩu.'
        }
        action={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Ghi nhận biến động
          </button>
        }
      />

      <div className="card">
        <FilterBar
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
          advanced={
            <>
              <AsyncCombobox
                kind="residents"
                label="Nhân khẩu"
                value={filters.residentId ? Number(filters.residentId) : null}
                onChange={(item) => setFilter('residentId', item ? String(item.id) : '')}
              />
              <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
            </>
          }
        >
          <SearchInput id="rh-q" label="Tên / CCCD / mã hộ / mã căn" value={filters.q} onChange={(v) => setFilter('q', v)} />
          <SelectFilter
            id="rh-type"
            label="Loại biến động"
            value={filters.historyType}
            onChange={(v) => setFilter('historyType', v)}
            options={Object.entries(HISTORY_TYPE_LABELS).map(([value, l]) => ({ value, label: l }))}
          />
          <div className="field">
            <label htmlFor="rh-from">Từ ngày</label>
            <input id="rh-from" type="date" value={filters.fromDate} onChange={(e) => setFilter('fromDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="rh-to">Đến ngày</label>
            <input id="rh-to" type="date" value={filters.toDate} onChange={(e) => setFilter('toDate', e.target.value)} />
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(h) => h.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          emptyText="Chưa có biến động cư trú nào."
        />
        {list.data && (
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />
        )}
      </div>

      <Modal
        open={open}
        size="lg"
        title="Ghi nhận biến động cư trú"
        onClose={() => setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button type="submit" form="history-form" className="btn btn-primary">
              Tiếp tục
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="history-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <AsyncCombobox
            kind="residents"
            label="Nhân khẩu"
            required
            value={form.residentId}
            initialLabel={form.residentLabel}
            onChange={(item) => setForm({ ...form, residentId: item?.id ?? null, residentLabel: item ? `${item.label} — ${item.description ?? ''}` : undefined })}
            placeholder="Gõ họ tên (không dấu) / CCCD…"
          />
          <div className="field">
            <label htmlFor="f-rh-type">Loại biến động *</label>
            <select id="f-rh-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as HistoryType })}>
              {Object.entries(HISTORY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-rh-start">{form.type === 'MoveIn' || form.type === 'MoveOut' ? 'Ngày biến động *' : 'Từ ngày *'}</label>
            <input id="f-rh-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="f-rh-end">
              Đến ngày {form.type === 'TemporaryAbsence' || form.type === 'TemporaryResidence' ? '*' : ''}
            </label>
            <input id="f-rh-end" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          {form.type !== 'InformationChange' ? (
            <div className="field span-2">
              <label htmlFor="f-rh-dest">{form.type === 'MoveIn' || form.type === 'TemporaryResidence' ? 'Chuyển đến từ' : 'Nơi chuyển đến / đi tới'}</label>
              <input id="f-rh-dest" maxLength={200} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="f-rh-prev">Giá trị cũ *</label>
                <input id="f-rh-prev" maxLength={2000} value={form.previousValue} onChange={(e) => setForm({ ...form, previousValue: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="f-rh-new">Giá trị mới *</label>
                <input id="f-rh-new" maxLength={2000} value={form.newValue} onChange={(e) => setForm({ ...form, newValue: e.target.value })} />
              </div>
            </>
          )}
          <div className="field span-2">
            <label htmlFor="f-rh-note">Ghi chú / lý do *</label>
            <textarea id="f-rh-note" maxLength={1000} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {STATUS_AFTER[form.type] && (
            <div className="alert alert-info span-2 mb-0">
              Sau khi lưu, tình trạng cư trú của nhân khẩu sẽ chuyển thành <strong>{label(RESIDENT_STATUS_LABELS, STATUS_AFTER[form.type])}</strong>.
            </div>
          )}
        </form>
      </Modal>

      <Modal open={Boolean(detail)} title="Chi tiết biến động" onClose={() => setDetail(null)}>
        {detail && (
          <dl className="detail-list">
            <dt>Nhân khẩu</dt>
            <dd>{detail.residentFullName}</dd>
            <dt>Hộ / Căn hộ</dt>
            <dd>
              {detail.householdCode} / {detail.apartmentCode}
            </dd>
            <dt>Loại biến động</dt>
            <dd>{label(HISTORY_TYPE_LABELS, detail.historyType)}</dd>
            <dt>Từ ngày</dt>
            <dd>{formatDate(detail.startDate)}</dd>
            <dt>Đến ngày</dt>
            <dd>{formatDate(detail.endDate)}</dd>
            <dt>Nơi đến / đi</dt>
            <dd>{detail.destination || '—'}</dd>
            {detail.historyType === 'InformationChange' && (
              <>
                <dt>Giá trị cũ</dt>
                <dd>{detail.previousValue || '—'}</dd>
                <dt>Giá trị mới</dt>
                <dd>{detail.newValue || '—'}</dd>
              </>
            )}
            <dt>Ghi chú</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{detail.note}</dd>
          </dl>
        )}
      </Modal>
    </>
  )
}
