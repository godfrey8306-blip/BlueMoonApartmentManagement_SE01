/**
 * PaymentsPage.tsx — /payments (D1 · PBI-013 / US-008, PBI-016, PBI-017 / US-010)
 *  - Danh sách phiếu thu phân trang phía server, lọc theo ngày / căn / người nộp / phương thức / tòa.
 *  - Ghi nhận thanh toán: chọn căn (gõ để tìm) → chọn khoản còn nợ → BƯỚC XÁC NHẬN tóm tắt → lưu.
 *    Phiếu thu không sửa/xóa được sau khi lưu.
 *  - Query: ?new=1&apartmentId=..&feeChargeId=.. (mở sẵn form từ màn Công nợ)
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { BuildingFilter, FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { AsyncCombobox } from '../components/AsyncCombobox'
import { Loading } from '../components/DataState'
import { Modal } from '../components/Modal'
import { Feedback } from '../components/Feedback'
import { StatusBadge } from '../components/StatusBadge'
import { useListQuery } from '../hooks/useListQuery'
import { useUI } from '../context/UIContext'
import { feeChargesApi, fetchAllPages, paymentsApi, residentsApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import { PAYMENT_METHODS, exportCsv, formatDate, formatDateTime, formatMoney, todayInput } from '../lib/format'
import type { FeeCharge, Payment, Resident } from '../types/models'

interface Line {
  selected: boolean
  amount: string
}
const FILTERS = ['q', 'fromDate', 'toDate', 'method', 'building'] as const

export function ReceiptView({ payment }: { payment: Payment }) {
  return (
    <div className="printable">
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div className="fw-bold" style={{ fontSize: '1.05rem' }}>
          BAN QUẢN TRỊ CHUNG CƯ BLUEMOON
        </div>
        <div className="fw-bold" style={{ fontSize: '1.3rem', marginTop: 6 }}>
          PHIẾU THU
        </div>
        <div className="text-muted">Số: {payment.receiptNumber}</div>
      </div>
      <dl className="detail-list mb-16">
        <dt>Căn hộ</dt>
        <dd>{payment.apartmentCode}</dd>
        <dt>Người nộp</dt>
        <dd>{payment.residentFullName || '—'}</dd>
        <dt>Ngày thanh toán</dt>
        <dd>{formatDateTime(payment.paymentDate)}</dd>
        <dt>Phương thức</dt>
        <dd>{payment.paymentMethod}</dd>
        <dt>Người thu</dt>
        <dd>{payment.receivedByUsername || `#${payment.receivedByUserId}`}</dd>
        {payment.note && (
          <>
            <dt>Ghi chú</dt>
            <dd>{payment.note}</dd>
          </>
        )}
      </dl>
      <table>
        <thead>
          <tr>
            <th>Khoản thu</th>
            <th>Đợt thu</th>
            <th>Hạn nộp</th>
            <th className="text-right">Số tiền</th>
          </tr>
        </thead>
        <tbody>
          {payment.details.map((d) => (
            <tr key={d.id}>
              <td>{d.feeCategoryName}</td>
              <td>{d.feeCollectionName}</td>
              <td>
                {formatDate(d.dueDate)} {d.isLate && <StatusBadge value="late" tone="warning" label="Nộp trễ" />}
              </td>
              <td className="text-right">{formatMoney(d.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Tổng cộng</td>
            <td className="text-right">{formatMoney(payment.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function PaymentsPage() {
  const { toast, confirm } = useUI()
  const [params, setParams] = useSearchParams()
  const list = useListQuery(FILTERS, (p) => paymentsApi.list(p))
  const { filters, setFilter } = list

  const [viewing, setViewing] = useState<Payment | null>(null)
  const [exporting, setExporting] = useState<string>()

  // ── Tạo phiếu thu ───────────────────────────────────────
  const [open, setOpen] = useState(false)
  const [apartment, setApartment] = useState<{ id: number; label: string } | null>(null)
  const [form, setForm] = useState({ residentId: '', receiptNumber: '', paymentDate: todayInput(), paymentMethod: PAYMENT_METHODS[0], note: '' })
  const [charges, setCharges] = useState<FeeCharge[]>([])
  const [residents, setResidents] = useState<Resident[]>([])
  const [lines, setLines] = useState<Record<number, Line>>({})
  const [loadingApt, setLoadingApt] = useState(false)
  const [formError, setFormError] = useState<string>()

  async function loadApartment(aptId: number | null, preselectChargeId?: number) {
    setCharges([])
    setResidents([])
    setLines({})
    if (!aptId) return
    setLoadingApt(true)
    try {
      const [summary, res] = await Promise.all([
        feeChargesApi.byApartment(aptId),
        residentsApi.list({ apartmentId: aptId, page: 1, pageSize: 50, status: 'Active,TemporaryResident,TemporarilyAbsent' }),
      ])
      const outstanding = summary.charges
        .filter((c) => c.outstandingAmount > 0 && c.feeCollectionStatus !== 'Cancelled')
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      setApartment({ id: aptId, label: summary.apartmentCode })
      setCharges(outstanding)
      setResidents(res.items)
      const head = res.items.find((r) => r.isHouseholdHead)
      setForm((f) => ({ ...f, residentId: head ? String(head.id) : '' }))
      const init: Record<number, Line> = {}
      for (const c of outstanding) {
        // Mặc định chọn các khoản quá hạn (ưu tiên thu nợ cũ) hoặc khoản được chỉ định
        init[c.id] = { selected: preselectChargeId ? c.id === preselectChargeId : c.isOverdue, amount: String(c.outstandingAmount) }
      }
      setLines(init)
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setLoadingApt(false)
    }
  }

  async function openCreate(aptId: number | null = null, chargeId?: number) {
    setApartment(null)
    setForm({ residentId: '', receiptNumber: '', paymentDate: todayInput(), paymentMethod: PAYMENT_METHODS[0], note: '' })
    setFormError(undefined)
    setOpen(true)
    paymentsApi
      .nextReceiptNumber()
      .then((rn) => setForm((f) => ({ ...f, receiptNumber: rn })))
      .catch(() => undefined)
    if (aptId) await loadApartment(aptId, chargeId)
  }

  useEffect(() => {
    if (params.get('new') === '1') {
      const aptId = params.get('apartmentId')
      const chargeId = params.get('feeChargeId')
      void openCreate(aptId ? Number(aptId) : null, chargeId ? Number(chargeId) : undefined)
      const next = new URLSearchParams(params)
      next.delete('new')
      next.delete('apartmentId')
      next.delete('feeChargeId')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedLines = charges.filter((c) => lines[c.id]?.selected)
  const paymentTotal = selectedLines.reduce((s, c) => s + (Number(lines[c.id]?.amount) || 0), 0)

  function setLine(id: number, patch: Partial<Line>) {
    setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!apartment) return setFormError('Vui lòng chọn căn hộ.')
    if (!form.receiptNumber.trim()) return setFormError('Vui lòng nhập mã phiếu thu.')
    if (!form.paymentMethod.trim()) return setFormError('Vui lòng chọn phương thức thanh toán.')
    if (form.paymentDate > todayInput()) return setFormError('Ngày thanh toán không được ở tương lai.')
    if (selectedLines.length === 0) return setFormError('Chọn ít nhất một khoản phải thu để thanh toán.')
    for (const c of selectedLines) {
      const amount = Number(lines[c.id].amount)
      if (!(amount >= 1)) return setFormError(`Số tiền cho "${c.feeCategoryName}" phải lớn hơn 0.`)
      if (amount > c.outstandingAmount) return setFormError(`Số tiền cho "${c.feeCategoryName}" vượt quá số còn nợ (${formatMoney(c.outstandingAmount)}).`)
    }
    setFormError(undefined)

    const payer = residents.find((r) => String(r.id) === form.residentId)
    const lateCount = selectedLines.filter((c) => c.isOverdue).length
    let created: Payment | undefined
    const ok = await confirm(`Xác nhận thu ${formatMoney(paymentTotal)} của căn ${apartment.label}?`, {
      title: 'Xác nhận ghi nhận thanh toán',
      confirmText: `Xác nhận thu ${formatMoney(paymentTotal)}`,
      details: [
        ['Mã phiếu thu', form.receiptNumber.trim()],
        ['Căn hộ', apartment.label],
        ['Người nộp', payer?.fullName ?? '— Không xác định —'],
        ['Ngày thu', formatDate(form.paymentDate)],
        ['Phương thức', form.paymentMethod],
        ...selectedLines.map(
          (c) =>
            [
              `${c.feeCategoryName} ${String(c.feeCollectionMonth).padStart(2, '0')}/${c.feeCollectionYear}`,
              `${formatMoney(Number(lines[c.id].amount))}${Number(lines[c.id].amount) < c.outstandingAmount ? ' (một phần)' : ''}${c.isOverdue ? ' · quá hạn' : ''}`,
            ] as [string, string],
        ),
        ['TỔNG CỘNG', <span className="text-success">{formatMoney(paymentTotal)}</span>],
      ],
      warning: `Phiếu thu KHÔNG thể sửa hoặc xóa sau khi lưu.${lateCount ? ` Có ${lateCount} khoản nộp sau hạn.` : ''} Hộ có tài khoản cổng cư dân sẽ nhận biên nhận.`,
      onConfirm: async () => {
        const paymentDate = form.paymentDate === todayInput() ? new Date().toISOString() : `${form.paymentDate}T05:00:00Z`
        created = await paymentsApi.create({
          apartmentId: apartment.id,
          residentId: form.residentId ? Number(form.residentId) : null,
          receiptNumber: form.receiptNumber.trim(),
          paymentDate,
          paymentMethod: form.paymentMethod.trim(),
          note: form.note.trim() || null,
          details: selectedLines.map((c) => ({ feeChargeId: c.id, amount: Number(lines[c.id].amount) })),
        })
      },
    })
    if (!ok || !created) return
    toast.success(`Đã ghi nhận phiếu thu ${created.receiptNumber} — ${formatMoney(created.totalAmount)}.`)
    setOpen(false)
    setViewing(created)
    list.reload()
  }

  async function handleExport() {
    setExporting('Đang tải…')
    try {
      const all = await fetchAllPages<Payment>('/payments', list.params, (n, t) => setExporting(`Đang tải ${n}/${t}…`))
      exportCsv(
        `lich-su-thanh-toan-${todayInput()}.csv`,
        ['Mã phiếu', 'Căn hộ', 'Người nộp', 'Ngày', 'Phương thức', 'Tổng tiền', 'Người thu', 'Chi tiết', 'Ghi chú'],
        all.map((p) => [
          p.receiptNumber,
          p.apartmentCode,
          p.residentFullName,
          formatDateTime(p.paymentDate),
          p.paymentMethod,
          p.totalAmount,
          p.receivedByUsername,
          p.details.map((d) => `${d.feeCategoryName} (${d.feeCollectionName}): ${d.amount}${d.isLate ? ' [trễ]' : ''}`).join(' | '),
          p.note,
        ]),
      )
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setExporting(undefined)
    }
  }

  const columns: Column<Payment>[] = [
    { key: 'receipt', header: 'Mã phiếu', sortKey: 'receipt', render: (p) => <span className="fw-bold">{p.receiptNumber}</span> },
    { key: 'apt', header: 'Căn hộ', sortKey: 'apartment', render: (p) => p.apartmentCode },
    { key: 'payer', header: 'Người nộp', render: (p) => p.residentFullName || '—' },
    { key: 'date', header: 'Ngày thu', sortKey: 'date', render: (p) => formatDateTime(p.paymentDate) },
    {
      key: 'items',
      header: 'Khoản thu',
      className: 'wrap',
      render: (p) => (
        <>
          {p.details.map((d) => d.feeCategoryName).join(', ')}
          {p.details.some((d) => d.isLate) && (
            <span style={{ marginLeft: 6 }}>
              <StatusBadge value="late" tone="warning" label="Có khoản trễ hạn" />
            </span>
          )}
        </>
      ),
    },
    { key: 'amount', header: 'Tổng tiền', sortKey: 'amount', align: 'right', render: (p) => <span className="fw-bold">{formatMoney(p.totalAmount)}</span> },
    { key: 'method', header: 'Phương thức', sortKey: 'method', render: (p) => p.paymentMethod },
    { key: 'by', header: 'Người thu', render: (p) => p.receivedByUsername || '—' },
    {
      key: 'a',
      header: '',
      align: 'right',
      render: (p) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(p)}>
          Xem phiếu
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Thanh toán"
        description="Ghi nhận các khoản cư dân đã đóng, tra cứu phiếu thu và lịch sử đóng tiền."
        action={
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={!!exporting || !list.data?.total}>
              {exporting ?? '⬇ Xuất CSV'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
              + Ghi nhận thanh toán
            </button>
          </div>
        }
      />

      <div className="card">
        <FilterBar
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
          extra={list.data?.totalAmount !== undefined && <span className="chip">Tổng theo bộ lọc: <strong>{formatMoney(list.data.totalAmount)}</strong></span>}
        >
          <SearchInput id="pm-q" label="Mã phiếu / mã căn / tên người nộp" value={filters.q} onChange={(v) => setFilter('q', v)} />
          <div className="field">
            <label htmlFor="pm-from">Từ ngày</label>
            <input id="pm-from" type="date" value={filters.fromDate} onChange={(e) => setFilter('fromDate', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pm-to">Đến ngày</label>
            <input id="pm-to" type="date" value={filters.toDate} onChange={(e) => setFilter('toDate', e.target.value)} />
          </div>
          <SelectFilter id="pm-method" label="Phương thức" value={filters.method} onChange={(v) => setFilter('method', v)} options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} />
          <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
        </FilterBar>

        <DataTable
          columns={columns}
          rows={list.data?.items}
          rowKey={(p) => p.id}
          loading={list.loading}
          error={list.error}
          onRetry={list.reload}
          sort={list.sort}
          onSort={list.setSort}
          emptyText="Không tìm thấy phiếu thu nào."
        />
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>

      <Modal
        open={open}
        size="lg"
        title="Ghi nhận thanh toán"
        onClose={() => setOpen(false)}
        footer={
          <>
            <span className="text-muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>
              Tổng thanh toán: <strong style={{ color: '#172033' }}>{formatMoney(paymentTotal)}</strong>
            </span>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button type="submit" form="payment-form" className="btn btn-primary" disabled={loadingApt || selectedLines.length === 0}>
              Kiểm tra & xác nhận →
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="payment-form" onSubmit={handleSubmit} noValidate>
          <div className="form-grid mb-16">
            <AsyncCombobox
              kind="apartments"
              label="Căn hộ"
              required
              value={apartment?.id ?? null}
              initialLabel={apartment?.label}
              params={{ occupied: true }}
              placeholder="Gõ mã căn / mã hộ / tên chủ hộ…"
              onChange={(item) => {
                setApartment(item ? { id: item.id, label: item.label } : null)
                void loadApartment(item?.id ?? null)
              }}
            />
            <div className="field">
              <label htmlFor="f-pm-res">Người nộp</label>
              <select id="f-pm-res" value={form.residentId} onChange={(e) => setForm({ ...form, residentId: e.target.value })} disabled={!apartment}>
                <option value="">— Không xác định —</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                    {r.isHouseholdHead ? ' (chủ hộ)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-pm-receipt">Mã phiếu thu *</label>
              <input id="f-pm-receipt" maxLength={100} value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-pm-date">Ngày thanh toán *</label>
              <input id="f-pm-date" type="date" max={todayInput()} value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="f-pm-method">Phương thức *</label>
              <select id="f-pm-method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="f-pm-note">Ghi chú</label>
              <input id="f-pm-note" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: mã giao dịch chuyển khoản" />
            </div>
          </div>

          <h3 className="section-title">Khoản còn nợ của căn hộ</h3>
          {!apartment ? (
            <div className="empty">Chọn căn hộ để xem các khoản còn nợ.</div>
          ) : loadingApt ? (
            <Loading />
          ) : charges.length === 0 ? (
            <div className="empty">Căn hộ này không còn khoản nợ nào. 🎉</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        checked={selectedLines.length === charges.length}
                        onChange={(e) => {
                          const next: Record<number, Line> = {}
                          for (const c of charges) next[c.id] = { ...lines[c.id], selected: e.target.checked }
                          setLines(next)
                        }}
                      />
                    </th>
                    <th>Kỳ</th>
                    <th>Khoản thu</th>
                    <th>Hạn nộp</th>
                    <th className="text-right">Còn nợ</th>
                    <th className="text-right">Số tiền thu</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => {
                    const line = lines[c.id]
                    const amount = Number(line?.amount)
                    const invalid = line?.selected && (!(amount >= 1) || amount > c.outstandingAmount)
                    return (
                      <tr key={c.id} className={c.isOverdue ? 'row-overdue' : undefined}>
                        <td>
                          <input type="checkbox" aria-label={`Chọn ${c.feeCategoryName}`} checked={line?.selected ?? false} onChange={(e) => setLine(c.id, { selected: e.target.checked })} />
                        </td>
                        <td>
                          {String(c.feeCollectionMonth).padStart(2, '0')}/{c.feeCollectionYear}
                        </td>
                        <td>{c.feeCategoryName}</td>
                        <td className={c.isOverdue ? 'text-danger fw-bold' : ''}>
                          {formatDate(c.dueDate)}
                          {c.isOverdue && <div className="small">quá hạn {c.daysOverdue} ngày</div>}
                        </td>
                        <td className="text-right text-danger fw-bold">{formatMoney(c.outstandingAmount)}</td>
                        <td className="text-right">
                          <input
                            type="number"
                            min={1}
                            max={c.outstandingAmount}
                            step="any"
                            aria-label={`Số tiền thu cho ${c.feeCategoryName}`}
                            disabled={!line?.selected}
                            value={line?.amount ?? ''}
                            onChange={(e) => setLine(c.id, { amount: e.target.value })}
                            className="select-sm"
                            style={{ width: 140, textAlign: 'right', borderColor: invalid ? '#ef4444' : undefined }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </form>
      </Modal>

      <Modal
        open={Boolean(viewing)}
        title={viewing ? `Phiếu thu ${viewing.receiptNumber}` : ''}
        onClose={() => setViewing(null)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setViewing(null)}>
              Đóng
            </button>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              🖨 In phiếu
            </button>
          </>
        }
      >
        {viewing && <ReceiptView payment={viewing} />}
      </Modal>
    </>
  )
}
