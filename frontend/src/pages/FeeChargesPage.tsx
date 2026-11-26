/**
 * FeeChargesPage.tsx — /fee-charges (C3 · PBI-011, PBI-014, PBI-015 / US-009)
 *  - Lọc nhanh: Còn nợ / Quá hạn / Sắp đến hạn / Đã thanh toán; lọc theo đợt, khoản, tòa, căn/hộ/chủ hộ.
 *  - Thẻ tổng (phải thu / đã thu / còn nợ) tính trên TOÀN BỘ tập lọc (header từ server).
 *  - Chọn nhiều dòng → gửi nhắc nợ cho các căn quá hạn.
 *  - Sinh danh sách phải thu: xem trước phía server → xác nhận → tạo trong 1 giao dịch.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { BuildingFilter, FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { ChargeStatus, DueDate } from '../components/FeeBadges'
import { DataState, Loading } from '../components/DataState'
import { Modal } from '../components/Modal'
import { Feedback } from '../components/Feedback'
import { useListQuery } from '../hooks/useListQuery'
import { useAsync } from '../hooks/useAsync'
import { useUI } from '../context/UIContext'
import { feeCategoriesApi, feeChargesApi, feeCollectionsApi, fetchAllPages, notificationsApi, paymentsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import {
  CALCULATION_METHODS,
  CHARGE_STATUS_LABELS,
  dateInputToIso,
  exportCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  isoDatePart,
  label,
  todayInput,
} from '../lib/format'
import type { FeeCharge, FeeChargeGenerateResult } from '../types/models'

const FILTERS = ['view', 'q', 'feeCollectionId', 'feeCategoryId', 'building', 'status', 'apartmentId'] as const
const VIEWS = [
  { value: '', label: 'Tất cả' },
  { value: 'outstanding', label: 'Còn nợ' },
  { value: 'overdue', label: 'Quá hạn', tone: 'danger' },
  { value: 'dueSoon', label: 'Sắp đến hạn (7 ngày)', tone: 'warning' },
  { value: 'paid', label: 'Đã thanh toán' },
]

/** Chuyển "view" thành tham số API. */
function toApiParams(p: Record<string, string | number>) {
  const { view, ...rest } = p as Record<string, string | number> & { view?: string }
  const extra: Record<string, string> = {}
  if (view === 'outstanding') extra.outstanding = 'true'
  if (view === 'overdue') extra.overdue = 'true'
  if (view === 'dueSoon') extra.dueSoon = 'true'
  if (view === 'paid') extra.status = 'Paid'
  return { ...rest, ...extra }
}

export function FeeChargesPage() {
  const { toast, confirm } = useUI()
  const list = useListQuery(FILTERS, (p) => feeChargesApi.list(toApiParams(p)))
  const { filters, setFilter } = list

  const collections = useAsync(() => feeCollectionsApi.list(), [])
  const categories = useAsync(() => feeCategoriesApi.list(), [])
  const alerts = useAsync(() => notificationsApi.alerts(), [list.data])

  const openCollections = (collections.data ?? []).filter((c) => c.status === 'Open')
  const mandatoryCategories = (categories.data ?? []).filter((c) => c.isActive && c.isMandatory)
  const [selected, setSelected] = useState<Set<string | number>>(new Set())
  const [exporting, setExporting] = useState<string>()

  // ── Nhắc nợ ─────────────────────────────────────────────
  const selectedRows = (list.data?.items ?? []).filter((c) => selected.has(c.id))
  const selectedOverdueApartments = [...new Set(selectedRows.filter((c) => c.isOverdue).map((c) => c.apartmentId))]

  async function remind(apartmentIds: number[] | null) {
    let result = { noticeCount: 0, notifiedAccountCount: 0, totalAmount: 0 }
    const scope = apartmentIds ? `${apartmentIds.length} căn hộ đã chọn` : `tất cả ${alerts.data?.overdueApartmentCount ?? ''} căn hộ có khoản quá hạn`
    const ok = await confirm(`Gửi nhắc nợ quá hạn cho ${scope}?`, {
      title: 'Gửi nhắc nợ',
      confirmText: 'Gửi nhắc nợ',
      details: apartmentIds
        ? [['Căn hộ', selectedRows.filter((c) => c.isOverdue).map((c) => c.apartmentCode).filter((v, i, a) => a.indexOf(v) === i).join(', ')]]
        : [
            ['Số căn quá hạn', String(alerts.data?.overdueApartmentCount ?? '—')],
            ['Tổng quá hạn', formatMoney(alerts.data?.overdueAmount ?? 0)],
          ],
      warning: 'Mỗi căn sẽ có một giấy nhắc nợ (in được) và hộ có tài khoản cổng cư dân nhận thông báo ngay.',
      onConfirm: async () => {
        result = await feeChargesApi.remind({ apartmentIds })
      },
    })
    if (!ok) return
    toast.success(`Đã nhắc nợ ${result.noticeCount} căn (${formatMoney(result.totalAmount)}), ${result.notifiedAccountCount} tài khoản cư dân nhận thông báo.`)
    setSelected(new Set())
    window.dispatchEvent(new Event('notifications:changed'))
  }

  // ── Sửa / xóa / lịch sử ─────────────────────────────────
  const [editing, setEditing] = useState<FeeCharge | null>(null)
  const [editForm, setEditForm] = useState({ quantity: '', dueDate: '' })
  const [editError, setEditError] = useState<string>()

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const quantity = Number(editForm.quantity)
    if (!(quantity >= 0.01)) return setEditError('Số lượng phải ≥ 0,01.')
    const newTotal = quantity * editing.unitPrice
    if (newTotal < editing.paidAmount) return setEditError('Tổng tiền mới không được nhỏ hơn số đã thu.')
    setEditError(undefined)
    const ok = await confirm(`Cập nhật khoản "${editing.feeCategoryName}" của căn ${editing.apartmentCode}?`, {
      title: 'Xác nhận sửa khoản phải thu',
      confirmText: 'Lưu thay đổi',
      details: [
        ['Số lượng', `${formatNumber(editing.quantity)} → ${formatNumber(quantity)} ${editing.feeCategoryUnit}`],
        ['Thành tiền', `${formatMoney(editing.totalAmount)} → ${formatMoney(newTotal)}`],
        ['Hạn nộp', `${formatDate(editing.dueDate)} → ${formatDate(editForm.dueDate)}`],
      ],
      onConfirm: () => feeChargesApi.update(editing.id, { quantity, dueDate: dateInputToIso(editForm.dueDate) }),
    })
    if (!ok) return
    toast.success('Đã cập nhật khoản phải thu.')
    setEditing(null)
    list.reload()
  }

  async function handleDelete(c: FeeCharge) {
    const ok = await confirm(`Xóa khoản "${c.feeCategoryName}" của căn ${c.apartmentCode}?`, {
      title: 'Xóa khoản phải thu',
      danger: true,
      confirmText: 'Xóa',
      details: [
        ['Đợt thu', c.feeCollectionName],
        ['Số tiền', formatMoney(c.totalAmount)],
      ],
      warning: 'Chỉ xóa được khoản chưa có thanh toán.',
      onConfirm: () => feeChargesApi.remove(c.id),
    })
    if (!ok) return
    toast.success('Đã xóa khoản phải thu.')
    list.reload()
  }

  const [historyOf, setHistoryOf] = useState<FeeCharge | null>(null)
  const history = useAsync(() => paymentsApi.byFeeCharge(historyOf!.id), [historyOf?.id], Boolean(historyOf))

  // ── Thêm 1 khoản ────────────────────────────────────────
  const [single, setSingle] = useState<{ feeCollectionId: string; apartmentId: number | null; feeCategoryId: string; quantity: string; dueDate: string } | null>(null)
  const [singleError, setSingleError] = useState<string>()

  async function saveSingle(e: FormEvent) {
    e.preventDefault()
    if (!single) return
    const quantity = Number(single.quantity)
    if (!single.feeCollectionId) return setSingleError('Vui lòng chọn đợt thu.')
    if (!single.apartmentId) return setSingleError('Vui lòng chọn căn hộ.')
    if (!single.feeCategoryId) return setSingleError('Vui lòng chọn khoản thu.')
    if (!(quantity >= 0.01)) return setSingleError('Số lượng phải ≥ 0,01.')
    const cat = categories.data?.find((c) => String(c.id) === single.feeCategoryId)
    setSingleError(undefined)
    const ok = await confirm('Thêm khoản phải thu?', {
      title: 'Xác nhận thêm khoản phải thu',
      confirmText: 'Thêm',
      details: [
        ['Đợt thu', collections.data?.find((c) => String(c.id) === single.feeCollectionId)?.name ?? ''],
        ['Khoản thu', cat?.name ?? ''],
        ['Thành tiền', formatMoney(quantity * (cat?.unitPrice ?? 0))],
        ['Hạn nộp', single.dueDate ? formatDate(single.dueDate) : 'Theo hạn của đợt thu'],
      ],
      onConfirm: () =>
        feeChargesApi.create({
          feeCollectionId: Number(single.feeCollectionId),
          apartmentId: single.apartmentId!,
          feeCategoryId: Number(single.feeCategoryId),
          quantity,
          dueDate: dateInputToIso(single.dueDate),
        }),
    })
    if (!ok) return
    toast.success('Đã thêm khoản phải thu.')
    setSingle(null)
    list.reload()
  }

  // ── Sinh danh sách phải thu ─────────────────────────────
  const [gen, setGen] = useState<{ feeCollectionId: string; feeCategoryId: string; mode: 'auto' | 'fixed'; fixedQuantity: string; onlyOccupied: boolean; dueDate: string } | null>(null)
  const [genError, setGenError] = useState<string>()
  const [preview, setPreview] = useState<FeeChargeGenerateResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const genCategory = categories.data?.find((c) => String(c.id) === gen?.feeCategoryId)
  const genCollection = collections.data?.find((c) => String(c.id) === gen?.feeCollectionId)

  function openGenerate() {
    const current = openCollections.find((c) => String(c.id) === filters.feeCollectionId) ?? openCollections[0]
    setGen({ feeCollectionId: current ? String(current.id) : '', feeCategoryId: '', mode: 'auto', fixedQuantity: '1', onlyOccupied: true, dueDate: '' })
    setPreview(null)
    setGenError(undefined)
  }

  function genInput(previewOnly: boolean) {
    return {
      feeCollectionId: Number(gen!.feeCollectionId),
      feeCategoryId: Number(gen!.feeCategoryId),
      mode: gen!.mode,
      fixedQuantity: gen!.mode === 'fixed' ? Number(gen!.fixedQuantity) : null,
      onlyOccupied: gen!.onlyOccupied,
      dueDate: dateInputToIso(gen!.dueDate),
      preview: previewOnly,
    }
  }

  async function runPreview() {
    if (!gen) return
    if (!gen.feeCollectionId) return setGenError('Vui lòng chọn đợt thu đang mở.')
    if (!gen.feeCategoryId) return setGenError('Vui lòng chọn khoản thu.')
    if (gen.mode === 'fixed' && !(Number(gen.fixedQuantity) >= 0.01)) return setGenError('Số lượng cố định phải ≥ 0,01.')
    setGenError(undefined)
    setPreviewing(true)
    try {
      setPreview(await feeChargesApi.generate(genInput(true)))
    } catch (err) {
      setGenError(errorMessage(err))
    } finally {
      setPreviewing(false)
    }
  }

  /** Xuất toàn bộ danh sách xem trước (kể cả căn bị bỏ qua) để kiểm tra trước khi lập. */
  function downloadPreviewCsv() {
    if (!preview || !genCategory || !genCollection) return
    const due = formatDate(preview.dueDate)
    const rows: (string | number)[][] = preview.rows.map((r) => [
      r.apartmentCode,
      r.building,
      r.householdCode ?? '',
      r.headOfHousehold ?? '',
      genCategory.name,
      r.quantity,
      genCategory.unit,
      genCategory.unitPrice,
      r.amount,
      due,
      r.exists ? 'Đã có — bỏ qua' : 'Sẽ lập mới',
    ])
    rows.push([])
    rows.push(['TỔNG SẼ LẬP', '', '', '', '', '', '', '', preview.totalAmount, '', `${preview.apartmentCount - preview.existingCount} khoản`])
    rows.push(['BỎ QUA (đã có)', '', '', '', '', '', '', '', '', '', `${preview.existingCount} căn`])
    const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    exportCsv(
      `xem-truoc-phai-thu-${genCollection.month}-${genCollection.year}-${slug(genCategory.name)}.csv`,
      ['Căn hộ', 'Tòa', 'Mã hộ', 'Chủ hộ', 'Khoản thu', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền', 'Hạn nộp', 'Ghi chú'],
      rows,
    )
  }

  async function runGenerate() {
    if (!gen || !preview || !genCategory) return
    const toCreate = preview.apartmentCount - preview.existingCount
    let created = 0
    const ok = await confirm(`Lập ${toCreate} khoản phải thu "${genCategory.name}"?`, {
      title: 'Xác nhận lập danh sách phải thu',
      confirmText: `Lập ${toCreate} khoản`,
      details: [
        ['Đợt thu', genCollection?.name ?? ''],
        ['Khoản thu', `${genCategory.name} — ${formatMoney(genCategory.unitPrice)}/${genCategory.unit}`],
        ['Số căn hộ', `${toCreate} (bỏ qua ${preview.existingCount} căn đã có)`],
        ['Tổng tiền', formatMoney(preview.totalAmount)],
        ['Hạn nộp', formatDate(preview.dueDate)],
      ],
      warning: 'Các khoản sẽ hiển thị ngay trong công nợ của từng căn hộ. Kế toán / ban quản trị khác sẽ nhận thông báo.',
      onConfirm: async () => {
        const r = await feeChargesApi.generate(genInput(false))
        created = r.createdCount
      },
    })
    if (!ok) return
    toast.success(`Đã lập ${created} khoản phải thu "${genCategory.name}".`)
    setGen(null)
    list.setFilters({ feeCollectionId: gen.feeCollectionId, feeCategoryId: gen.feeCategoryId, view: '' })
  }

  async function handleExport() {
    setExporting('Đang tải…')
    try {
      const all = await fetchAllPages<FeeCharge>('/fee-charges', toApiParams(list.params), (n, t) => setExporting(`Đang tải ${n}/${t}…`))
      exportCsv(
        `cong-no-${todayInput()}.csv`,
        ['Căn hộ', 'Tòa', 'Đợt thu', 'Khoản thu', 'Số lượng', 'Đơn giá', 'Tổng tiền', 'Đã thu', 'Còn nợ', 'Hạn nộp', 'Số ngày quá hạn', 'Trạng thái'],
        all.map((c) => [
          c.apartmentCode,
          c.apartmentBuilding,
          c.feeCollectionName,
          c.feeCategoryName,
          c.quantity,
          c.unitPrice,
          c.totalAmount,
          c.paidAmount,
          c.outstandingAmount,
          formatDate(c.dueDate),
          c.daysOverdue || '',
          label(CHARGE_STATUS_LABELS, c.status),
        ]),
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(undefined)
    }
  }

  const totals = list.data
  const columns: Column<FeeCharge>[] = [
    {
      key: 'apt',
      header: 'Căn hộ',
      sortKey: 'apartment',
      render: (c) => (
        <>
          <span className="fw-bold">{c.apartmentCode}</span> <span className="text-muted small">· {c.apartmentBuilding}</span>
        </>
      ),
    },
    {
      key: 'col',
      header: 'Đợt thu',
      sortKey: 'collection',
      render: (c) => (
        <>
          {String(c.feeCollectionMonth).padStart(2, '0')}/{c.feeCollectionYear}
          {c.feeCollectionStatus !== 'Open' && <span className="text-muted small"> · {c.feeCollectionStatus === 'Closed' ? 'đã đóng' : 'đã hủy'}</span>}
        </>
      ),
    },
    { key: 'cat', header: 'Khoản thu', sortKey: 'category', render: (c) => c.feeCategoryName },
    {
      key: 'qty',
      header: 'Số lượng',
      align: 'right',
      render: (c) => (
        <>
          {formatNumber(c.quantity)} <span className="text-muted small">{c.feeCategoryUnit}</span>
        </>
      ),
    },
    { key: 'total', header: 'Tổng tiền', sortKey: 'total', align: 'right', render: (c) => <span className="fw-bold">{formatMoney(c.totalAmount)}</span> },
    { key: 'paid', header: 'Đã thu', sortKey: 'paid', align: 'right', render: (c) => <span className="text-success">{formatMoney(c.paidAmount)}</span> },
    {
      key: 'out',
      header: 'Còn nợ',
      sortKey: 'outstanding',
      align: 'right',
      render: (c) => <span className={c.outstandingAmount > 0 ? 'text-danger fw-bold' : 'text-muted'}>{formatMoney(c.outstandingAmount)}</span>,
    },
    { key: 'due', header: 'Hạn nộp', sortKey: 'due', render: (c) => <DueDate charge={c} /> },
    { key: 'status', header: 'Trạng thái', sortKey: 'status', render: (c) => <ChargeStatus charge={c} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="actions">
          {c.outstandingAmount > 0 && c.feeCollectionStatus !== 'Cancelled' && (
            <Link className="btn btn-primary btn-sm" to={`/payments?new=1&apartmentId=${c.apartmentId}&feeChargeId=${c.id}`}>
              Thu tiền
            </Link>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHistoryOf(c)}>
            Lịch sử
          </button>
          {c.feeCollectionStatus === 'Open' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setEditing(c)
                setEditForm({ quantity: String(c.quantity), dueDate: isoDatePart(c.dueDate) })
                setEditError(undefined)
              }}
            >
              Sửa
            </button>
          )}
          {c.paidAmount === 0 && (
            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>
              Xóa
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Công nợ & Khoản phải thu"
        description="Lập danh sách phải thu theo kỳ, theo dõi hạn nộp, quá hạn và nhắc nợ."
        action={
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={!!exporting || !list.data?.total}>
              {exporting ?? '⬇ Xuất CSV'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSingle({ feeCollectionId: openCollections[0] ? String(openCollections[0].id) : '', apartmentId: null, feeCategoryId: '', quantity: '1', dueDate: '' })
                setSingleError(undefined)
              }}
            >
              + Thêm 1 khoản
            </button>
            <button type="button" className="btn btn-primary" onClick={openGenerate}>
              ⚡ Lập danh sách phải thu
            </button>
          </div>
        }
      />

      <div className="grid grid-4 mb-20">
        <div className="card stat-card">
          <div className="stat-label">Phải thu (theo bộ lọc)</div>
          <div className="stat-value">{formatMoney(totals?.totalAmount ?? 0)}</div>
          <div className="stat-sub">{(totals?.total ?? 0).toLocaleString('vi-VN')} khoản</div>
        </div>
        <div className="card stat-card tone-success">
          <div className="stat-label">Đã thu</div>
          <div className="stat-value">{formatMoney(totals?.paidAmount ?? 0)}</div>
          <div className="stat-sub">
            {totals?.totalAmount ? `${formatNumber(((totals.paidAmount ?? 0) / totals.totalAmount) * 100)}% tỷ lệ thu` : ''}
          </div>
        </div>
        <div className="card stat-card tone-warning">
          <div className="stat-label">Còn nợ</div>
          <div className="stat-value">{formatMoney(totals?.outstandingAmount ?? 0)}</div>
          <div className="stat-sub">{alerts.data ? `${alerts.data.dueSoonChargeCount} khoản sắp đến hạn` : ''}</div>
        </div>
        <button type="button" className="card stat-card tone-danger text-left" style={{ cursor: 'pointer' }} onClick={() => setFilter('view', 'overdue')}>
          <div className="stat-label">Quá hạn (toàn chung cư)</div>
          <div className="stat-value text-danger">{formatMoney(alerts.data?.overdueAmount ?? 0)}</div>
          <div className="stat-sub">
            {alerts.data ? `${alerts.data.overdueApartmentCount} căn · ${alerts.data.overdueChargeCount} khoản` : ''}
          </div>
        </button>
      </div>

      <div className="card">
        <div className="quick-filters" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              role="tab"
              aria-selected={filters.view === v.value}
              className={`quick-filter ${v.tone ? `tone-${v.tone}` : ''} ${filters.view === v.value ? 'active' : ''}`}
              onClick={() => setFilter('view', v.value)}
            >
              {v.label}
              {v.value === 'overdue' && alerts.data ? <span className="count">{alerts.data.overdueChargeCount}</span> : null}
              {v.value === 'dueSoon' && alerts.data ? <span className="count">{alerts.data.dueSoonChargeCount}</span> : null}
            </button>
          ))}
          <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => remind(null)} disabled={!alerts.data?.overdueApartmentCount}>
            ⏰ Nhắc nợ tất cả căn quá hạn
          </button>
        </div>

        <FilterBar
          activeCount={list.activeFilterCount - (filters.view ? 1 : 0)}
          onClear={() => list.setFilters({ q: '', feeCollectionId: '', feeCategoryId: '', building: '', status: '', apartmentId: '' })}
          advanced={
            <SelectFilter
              id="ch-status"
              label="Trạng thái thanh toán"
              value={filters.status}
              onChange={(v) => setFilter('status', v)}
              options={Object.entries(CHARGE_STATUS_LABELS).map(([value, l]) => ({ value, label: l }))}
            />
          }
        >
          <SearchInput id="ch-q" label="Mã căn / mã hộ / tên chủ hộ" value={filters.q} onChange={(v) => setFilter('q', v)} />
          <SelectFilter
            id="ch-col"
            label="Đợt thu"
            value={filters.feeCollectionId}
            onChange={(v) => setFilter('feeCollectionId', v)}
            options={(collections.data ?? []).map((c) => ({ value: String(c.id), label: `${c.name}${c.status !== 'Open' ? ` (${label({ Closed: 'đã đóng', Cancelled: 'đã hủy' }, c.status)})` : ''}` }))}
          />
          <SelectFilter
            id="ch-cat"
            label="Khoản thu"
            value={filters.feeCategoryId}
            onChange={(v) => setFilter('feeCategoryId', v)}
            options={(categories.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
        </FilterBar>

        {selected.size > 0 && (
          <div className="bulk-bar">
            Đã chọn {selected.size} khoản · {selectedOverdueApartments.length} căn quá hạn
            <button type="button" className="btn btn-danger btn-sm" disabled={selectedOverdueApartments.length === 0} onClick={() => remind(selectedOverdueApartments)}>
              ⏰ Nhắc nợ căn đã chọn
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Bỏ chọn
            </button>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(c) => c.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          rowClassName={(c) => (c.isOverdue ? 'row-overdue' : undefined)}
          emptyText={filters.view === 'overdue' ? 'Không có khoản nào quá hạn. 🎉' : 'Không có khoản phải thu phù hợp.'}
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>

      {/* ── Sửa ─────────────────────────────────────── */}
      <Modal
        open={Boolean(editing)}
        title="Sửa khoản phải thu"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Hủy
            </button>
            <button type="submit" form="charge-edit" className="btn btn-primary">
              Tiếp tục
            </button>
          </>
        }
      >
        {editing && (
          <>
            <Feedback error={editError} />
            <dl className="detail-list mb-16">
              <dt>Căn hộ</dt>
              <dd>{editing.apartmentCode}</dd>
              <dt>Khoản thu</dt>
              <dd>
                {editing.feeCategoryName} — {formatMoney(editing.unitPrice)}/{editing.feeCategoryUnit}
              </dd>
              <dt>Đã thu</dt>
              <dd>{formatMoney(editing.paidAmount)}</dd>
            </dl>
            <form id="charge-edit" className="form-grid" onSubmit={saveEdit} noValidate>
              <div className="field">
                <label htmlFor="e-qty">Số lượng *</label>
                <input id="e-qty" type="number" min={0.01} step="any" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                <span className="hint">Thành tiền: {formatMoney((Number(editForm.quantity) || 0) * editing.unitPrice)}</span>
              </div>
              <div className="field">
                <label htmlFor="e-due">Hạn nộp</label>
                <input id="e-due" type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* ── Thêm 1 khoản ────────────────────────────── */}
      <Modal
        open={Boolean(single)}
        title="Thêm khoản phải thu"
        onClose={() => setSingle(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setSingle(null)}>
              Hủy
            </button>
            <button type="submit" form="charge-single" className="btn btn-primary">
              Tiếp tục
            </button>
          </>
        }
      >
        {single && (
          <>
            <Feedback error={singleError} />
            <form id="charge-single" className="form-grid" onSubmit={saveSingle} noValidate>
              <div className="field span-2">
                <label htmlFor="s-col">Đợt thu * (đang mở)</label>
                <select id="s-col" value={single.feeCollectionId} onChange={(e) => setSingle({ ...single, feeCollectionId: e.target.value })}>
                  <option value="">— Chọn —</option>
                  {openCollections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (hạn {formatDate(c.dueDate)})
                    </option>
                  ))}
                </select>
              </div>
              <AsyncCombobox kind="apartments" label="Căn hộ" required value={single.apartmentId} onChange={(i) => setSingle({ ...single, apartmentId: i?.id ?? null })} />
              <div className="field">
                <label htmlFor="s-cat">Khoản thu *</label>
                <select id="s-cat" value={single.feeCategoryId} onChange={(e) => setSingle({ ...single, feeCategoryId: e.target.value })}>
                  <option value="">— Chọn —</option>
                  {(categories.data ?? [])
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {formatMoney(c.unitPrice)}/{c.unit}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-qty">Số lượng *</label>
                <input id="s-qty" type="number" min={0.01} step="any" value={single.quantity} onChange={(e) => setSingle({ ...single, quantity: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="s-due">Hạn nộp riêng</label>
                <input id="s-due" type="date" value={single.dueDate} onChange={(e) => setSingle({ ...single, dueDate: e.target.value })} />
                <span className="hint">Bỏ trống = theo hạn của đợt thu.</span>
              </div>
            </form>
          </>
        )}
      </Modal>

      {/* ── Lập danh sách phải thu ──────────────────── */}
      <Modal
        open={Boolean(gen)}
        size="lg"
        title="Lập danh sách phải thu theo kỳ"
        onClose={() => setGen(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setGen(null)}>
              Đóng
            </button>
            <button type="button" className="btn btn-secondary" onClick={runPreview} disabled={previewing}>
              {previewing ? 'Đang tính…' : '1. Xem trước'}
            </button>
            <button type="button" className="btn btn-primary" onClick={runGenerate} disabled={!preview || preview.apartmentCount === preview.existingCount}>
              2. Lập {preview ? preview.apartmentCount - preview.existingCount : 0} khoản
            </button>
          </>
        }
      >
        {gen && (
          <>
            <Feedback error={genError} />
            <div className="form-grid mb-16">
              <div className="field">
                <label htmlFor="g-col">Đợt thu * (đang mở)</label>
                <select
                  id="g-col"
                  value={gen.feeCollectionId}
                  onChange={(e) => {
                    setGen({ ...gen, feeCollectionId: e.target.value })
                    setPreview(null)
                  }}
                >
                  <option value="">— Chọn —</option>
                  {openCollections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (hạn {formatDate(c.dueDate)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="g-cat">Khoản thu bắt buộc *</label>
                <select
                  id="g-cat"
                  value={gen.feeCategoryId}
                  onChange={(e) => {
                    setGen({ ...gen, feeCategoryId: e.target.value })
                    setPreview(null)
                  }}
                >
                  <option value="">— Chọn —</option>
                  {mandatoryCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {formatMoney(c.unitPrice)}/{c.unit}
                    </option>
                  ))}
                </select>
                <span className="hint">Khoản tự nguyện không lập hàng loạt (không phải công nợ).</span>
              </div>
              <div className="field">
                <label>Cách xác định số lượng</label>
                <label className="check">
                  <input
                    type="radio"
                    name="mode"
                    checked={gen.mode === 'auto'}
                    onChange={() => {
                      setGen({ ...gen, mode: 'auto' })
                      setPreview(null)
                    }}
                  />
                  Tự động — {genCategory ? label(CALCULATION_METHODS, genCategory.calculationMethod) : 'theo cách tính của khoản thu'}
                </label>
                <label className="check">
                  <input
                    type="radio"
                    name="mode"
                    checked={gen.mode === 'fixed'}
                    onChange={() => {
                      setGen({ ...gen, mode: 'fixed' })
                      setPreview(null)
                    }}
                  />
                  Cố định cho mọi căn:
                  <input
                    type="number"
                    min={0.01}
                    step="any"
                    className="select-sm"
                    style={{ width: 90 }}
                    value={gen.fixedQuantity}
                    disabled={gen.mode !== 'fixed'}
                    onChange={(e) => {
                      setGen({ ...gen, fixedQuantity: e.target.value })
                      setPreview(null)
                    }}
                  />
                </label>
              </div>
              <div className="field">
                <label htmlFor="g-due">Hạn nộp riêng</label>
                <input
                  id="g-due"
                  type="date"
                  value={gen.dueDate}
                  onChange={(e) => {
                    setGen({ ...gen, dueDate: e.target.value })
                    setPreview(null)
                  }}
                />
                <span className="hint">Bỏ trống = {genCollection ? formatDate(genCollection.dueDate) : 'hạn của đợt thu'}.</span>
                <label className="check" style={{ marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={gen.onlyOccupied}
                    onChange={(e) => {
                      setGen({ ...gen, onlyOccupied: e.target.checked })
                      setPreview(null)
                    }}
                  />
                  Chỉ căn hộ có hộ gia đình đang ở
                </label>
              </div>
            </div>

            {previewing && <Loading text="Đang tính danh sách trên máy chủ…" />}
            {preview && !previewing && (
              <>
                <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{preview.apartmentCount}</strong> căn hộ · <strong>{preview.existingCount}</strong> đã có khoản này (bỏ qua) · sẽ lập{' '}
                    <strong>{preview.apartmentCount - preview.existingCount}</strong> khoản, tổng <strong>{formatMoney(preview.totalAmount)}</strong>, hạn{' '}
                    {formatDate(preview.dueDate)}.
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={downloadPreviewCsv}>
                    ⬇ Tải CSV xem trước
                  </button>
                </div>
                <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Căn hộ</th>
                        <th>Hộ / chủ hộ</th>
                        <th className="text-right">Số lượng</th>
                        <th className="text-right">Thành tiền</th>
                        <th>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.apartmentId} className={r.exists ? 'row-muted' : undefined}>
                          <td>{r.apartmentCode}</td>
                          <td>
                            {r.householdCode ?? <span className="text-muted">Chưa có hộ</span>}
                            {r.headOfHousehold && <span className="text-muted small"> · {r.headOfHousehold}</span>}
                          </td>
                          <td className="text-right">
                            {formatNumber(r.quantity)} {genCategory?.unit}
                          </td>
                          <td className="text-right">{formatMoney(r.amount)}</td>
                          <td>{r.exists ? 'Đã có — bỏ qua' : 'Sẽ lập mới'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </Modal>

      {/* ── Lịch sử thanh toán ──────────────────────── */}
      <Modal open={Boolean(historyOf)} title={historyOf ? `Lịch sử thanh toán — ${historyOf.apartmentCode} · ${historyOf.feeCategoryName}` : ''} onClose={() => setHistoryOf(null)}>
        {historyOf && (
          <>
            <p className="text-muted" style={{ marginTop: 0 }}>
              Tổng {formatMoney(historyOf.totalAmount)} · Đã thu {formatMoney(historyOf.paidAmount)} · Còn nợ {formatMoney(historyOf.outstandingAmount)} · Hạn{' '}
              {formatDate(historyOf.dueDate)}
            </p>
            <DataState loading={history.loading} error={history.error} empty={!history.data?.length} emptyText="Chưa có thanh toán nào cho khoản này.">
              <table>
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày</th>
                    <th>Phương thức</th>
                    <th className="text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data?.map((h) => (
                    <tr key={`${h.paymentId}-${h.receiptNumber}`}>
                      <td className="fw-bold">{h.receiptNumber}</td>
                      <td>{formatDateTime(h.paymentDate)}</td>
                      <td>{h.paymentMethod}</td>
                      <td className="text-right">{formatMoney(h.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </>
        )}
      </Modal>
    </>
  )
}
