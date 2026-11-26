/**
 * FeeCollectionsPage.tsx — /fee-collections (C2, PBI-011, PBI-012 / US-006)
 * Đợt thu theo tháng/năm có hạn nộp; phát hành giấy báo phí; đóng/mở/hủy có xác nhận.
 */
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataState } from '../components/DataState'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Feedback } from '../components/Feedback'
import { SelectFilter } from '../components/Filters'
import { useAsync } from '../hooks/useAsync'
import { useUI } from '../context/UIContext'
import { feeCollectionsApi, searchApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import {
  COLLECTION_STATUS_LABELS,
  MONTH_OPTIONS,
  dateInputToIso,
  formatDate,
  formatMoney,
  formatPercent,
  isoDatePart,
  label,
  todayInput,
} from '../lib/format'
import type { FeeCollection, FeeCollectionStatus } from '../types/models'

interface FormState {
  name: string
  month: string
  year: string
  dueDate: string
  status: FeeCollectionStatus
}

function lastDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 0)
  return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultForm(): FormState {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  return { name: `Thu phí tháng ${month}/${year}`, month: String(month), year: String(year), dueDate: lastDayOfMonth(year, month), status: 'Open' }
}

export function FeeCollectionsPage() {
  const { toast, confirm } = useUI()
  const [year, setYear] = useState('')
  const [status, setStatus] = useState('')

  const { data, loading, error, reload } = useAsync(
    () => feeCollectionsApi.list({ year: year || undefined, status: status || undefined }),
    [year, status],
  )
  const stats = useAsync(() => searchApi.collectionStats(), [])
  const statsById = useMemo(() => new Map((stats.data ?? []).map((s) => [s.feeCollectionId, s])), [stats.data])

  const [editing, setEditing] = useState<FeeCollection | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const refresh = () => {
    reload()
    stats.reload()
  }

  function openForm(c: FeeCollection | null) {
    setEditing(c)
    setForm(c ? { name: c.name, month: String(c.month), year: String(c.year), dueDate: isoDatePart(c.dueDate), status: c.status } : defaultForm())
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = form.name.trim()
    const m = Number(form.month)
    const y = Number(form.year)
    if (!name) return setFormError('Vui lòng nhập tên đợt thu.')
    if (!Number.isInteger(m) || m < 1 || m > 12) return setFormError('Tháng phải từ 1 đến 12.')
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return setFormError('Năm phải từ 2000 đến 2100.')
    if (!form.dueDate) return setFormError('Vui lòng chọn hạn nộp.')
    if (form.dueDate < `${y}-${String(m).padStart(2, '0')}-01`) return setFormError('Hạn nộp không được trước ngày đầu của kỳ thu.')
    setFormError(undefined)

    const dueChanged = editing && isoDatePart(editing.dueDate) !== form.dueDate
    if (!editing || dueChanged) {
      const ok = await confirm(editing ? `Đổi hạn nộp của "${name}"?` : `Mở đợt thu "${name}"?`, {
        title: editing ? 'Xác nhận đổi hạn nộp' : 'Xác nhận tạo đợt thu',
        confirmText: editing ? 'Đổi hạn nộp' : 'Tạo đợt thu',
        details: [
          ['Tên đợt thu', name],
          ['Kỳ thu', `${String(m).padStart(2, '0')}/${y}`],
          ['Hạn nộp', dueChanged ? `${formatDate(editing!.dueDate)} → ${formatDate(form.dueDate)}` : formatDate(form.dueDate)],
        ],
        warning: dueChanged
          ? 'Các khoản phải thu đang dùng hạn cũ của đợt sẽ chuyển sang hạn mới; trạng thái quá hạn được tính lại.'
          : 'Sau khi tạo, hãy lập danh sách phải thu ở màn hình Công nợ, rồi phát hành giấy báo phí.',
      })
      if (!ok) return
    }

    setSaving(true)
    try {
      if (editing) {
        await feeCollectionsApi.update(editing.id, { name, month: m, year: y, status: form.status, dueDate: dateInputToIso(form.dueDate) })
        toast.success(`Đã cập nhật đợt thu "${name}".`)
      } else {
        await feeCollectionsApi.create({ name, month: m, year: y, dueDate: dateInputToIso(form.dueDate) })
        toast.success(`Đã tạo đợt thu "${name}".`)
      }
      setOpen(false)
      refresh()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(c: FeeCollection, next: FeeCollectionStatus) {
    const s = statsById.get(c.id)
    const outstanding = s?.outstandingAmount ?? 0
    const verb = next === 'Closed' ? 'Đóng' : next === 'Cancelled' ? 'Hủy' : 'Mở lại'
    const ok = await confirm(`${verb} đợt thu "${c.name}"?`, {
      title: `${verb} đợt thu`,
      confirmText: `${verb} đợt thu`,
      danger: next !== 'Open',
      requireText: next === 'Cancelled' ? `HUY ${c.month}/${c.year}` : undefined,
      details: [
        ['Đợt thu', c.name],
        ['Số khoản phải thu', String(c.chargeCount)],
        ['Đã thu', formatMoney(s?.paidAmount ?? 0)],
        ['Còn nợ', <span className={outstanding > 0 ? 'text-danger' : ''}>{formatMoney(outstanding)}</span>],
      ],
      warning:
        next === 'Closed'
          ? outstanding > 0
            ? `Đợt thu còn ${formatMoney(outstanding)} chưa thu. Sau khi đóng không thể thêm khoản phải thu mới, nhưng vẫn ghi nhận thanh toán công nợ được.`
            : 'Sau khi đóng không thể thêm khoản phải thu mới.'
          : next === 'Cancelled'
            ? 'Hủy đợt thu: các khoản phải thu không còn tính vào công nợ. Chỉ hủy được đợt chưa có thanh toán.'
            : 'Mở lại để tiếp tục lập thêm khoản phải thu.',
      onConfirm: () => feeCollectionsApi.setStatus(c.id, next),
    })
    if (!ok) return
    toast.success(`Đã ${verb.toLowerCase()} đợt thu "${c.name}".`)
    refresh()
  }

  async function issueNotices(c: FeeCollection) {
    let issued = 0
    let notified = 0
    const s = statsById.get(c.id)
    const ok = await confirm(`Phát hành giấy báo phí cho đợt "${c.name}"?`, {
      title: 'Phát hành giấy báo phí',
      confirmText: 'Phát hành',
      details: [
        ['Đợt thu', c.name],
        ['Hạn nộp', formatDate(c.dueDate)],
        ['Số khoản phải thu', String(c.chargeCount)],
        ['Tổng phải thu', formatMoney(s?.totalAmount ?? 0)],
        ['Đã phát hành', `${c.noticeCount} căn (sẽ bỏ qua)`],
      ],
      warning: 'Mỗi căn hộ có khoản phải thu sẽ nhận một giấy báo. Hộ có tài khoản cổng cư dân sẽ nhận thông báo ngay; hộ khác hãy in giấy báo để gửi.',
      onConfirm: async () => {
        const r = await feeCollectionsApi.issueNotices(c.id, {})
        issued = r.noticeCount
        notified = r.notifiedAccountCount
      },
    })
    if (!ok) return
    if (issued === 0) toast.info('Tất cả căn hộ trong đợt đã được phát hành giấy báo trước đó.')
    else toast.success(`Đã phát hành ${issued} giấy báo phí, ${notified} tài khoản cư dân nhận thông báo.`)
    refresh()
  }

  async function handleDelete(c: FeeCollection) {
    const ok = await confirm(`Xóa đợt thu "${c.name}"?`, {
      title: 'Xóa đợt thu',
      danger: true,
      confirmText: 'Xóa',
      warning: 'Chỉ xóa được đợt thu chưa có khoản phải thu và chưa phát hành giấy báo.',
      onConfirm: () => feeCollectionsApi.remove(c.id),
    })
    if (!ok) return
    toast.success(`Đã xóa đợt thu "${c.name}".`)
    refresh()
  }

  const years = useMemo(() => {
    const now = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => String(now + 1 - i))
  }, [])
  const today = todayInput()

  return (
    <>
      <PageHeader
        title="Đợt thu & Giấy báo phí"
        description="Mỗi tháng một đợt thu có hạn nộp. Lập danh sách phải thu ở màn Công nợ, sau đó phát hành giấy báo cho cư dân."
        action={
          <button type="button" className="btn btn-primary" onClick={() => openForm(null)}>
            + Tạo đợt thu
          </button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <SelectFilter id="col-year" label="Năm" value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
          <SelectFilter
            id="col-status"
            label="Trạng thái"
            value={status}
            onChange={setStatus}
            options={Object.entries(COLLECTION_STATUS_LABELS).map(([value, l]) => ({ value, label: l }))}
          />
        </div>

        <DataState loading={loading} error={error} empty={!data?.length} emptyText="Chưa có đợt thu nào." onRetry={reload}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đợt thu</th>
                  <th>Hạn nộp</th>
                  <th className="text-right">Phải thu</th>
                  <th className="text-right">Đã thu</th>
                  <th className="text-right">Quá hạn</th>
                  <th>Tỷ lệ thu</th>
                  <th>Giấy báo</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data?.map((c) => {
                  const s = statsById.get(c.id)
                  const pastDue = isoDatePart(c.dueDate) < today && (s?.outstandingAmount ?? 0) > 0
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="fw-bold">{c.name}</div>
                        <div className="text-muted small">
                          Kỳ {String(c.month).padStart(2, '0')}/{c.year} · {c.chargeCount} khoản · tạo bởi {c.createdByUsername}
                        </div>
                      </td>
                      <td className={pastDue ? 'text-danger fw-bold' : ''}>{formatDate(c.dueDate)}</td>
                      <td className="text-right">{formatMoney(s?.totalAmount ?? 0)}</td>
                      <td className="text-right text-success">{formatMoney(s?.paidAmount ?? 0)}</td>
                      <td className={`text-right ${(s?.overdueAmount ?? 0) > 0 ? 'text-danger fw-bold' : 'text-muted'}`}>{formatMoney(s?.overdueAmount ?? 0)}</td>
                      <td>
                        <div className="rate-cell">
                          <div className="progress">
                            <span style={{ width: `${Math.min(100, s?.collectionRate ?? 0)}%` }} />
                          </div>
                          {formatPercent(s?.collectionRate ?? 0)}
                        </div>
                      </td>
                      <td>
                        {c.noticeCount > 0 ? (
                          <Link to={`/fee-collections/${c.id}/notices`}>{c.noticeCount} căn</Link>
                        ) : c.chargeCount > 0 ? (
                          <span className="badge badge-warning">Chưa phát hành</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={c.status} label={label(COLLECTION_STATUS_LABELS, c.status)} />
                      </td>
                      <td>
                        <div className="actions">
                          <Link className="btn btn-ghost btn-sm" to={`/fee-charges?feeCollectionId=${c.id}`}>
                            Công nợ
                          </Link>
                          {c.status !== 'Cancelled' && c.chargeCount > 0 && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => issueNotices(c)}>
                              📄 Giấy báo
                            </button>
                          )}
                          {c.status === 'Open' ? (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeStatus(c, 'Closed')}>
                              Đóng
                            </button>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => changeStatus(c, 'Open')}>
                              Mở lại
                            </button>
                          )}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openForm(c)}>
                            Sửa
                          </button>
                          {c.status !== 'Cancelled' && (
                            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => changeStatus(c, 'Cancelled')}>
                              Hủy
                            </button>
                          )}
                          {c.chargeCount === 0 && (
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>

      <Modal
        open={open}
        title={editing ? `Sửa đợt thu: ${editing.name}` : 'Tạo đợt thu'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="collection-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Tiếp tục'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        <form id="collection-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field span-2">
            <label htmlFor="f-col-name">Tên đợt thu *</label>
            <input id="f-col-name" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="f-col-month">Tháng *</label>
            <select
              id="f-col-month"
              value={form.month}
              onChange={(e) => {
                const m = Number(e.target.value)
                setForm({ ...form, month: e.target.value, name: `Thu phí tháng ${m}/${form.year}`, dueDate: lastDayOfMonth(Number(form.year), m) })
              }}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-col-year">Năm *</label>
            <input
              id="f-col-year"
              type="number"
              min={2000}
              max={2100}
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value, name: `Thu phí tháng ${form.month}/${e.target.value}` })}
            />
          </div>
          <div className="field span-2">
            <label htmlFor="f-col-due">Hạn nộp *</label>
            <input id="f-col-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <span className="hint">Mặc định ngày cuối tháng thu. Quá hạn này, khoản còn nợ được đánh dấu "Quá hạn" và có thể gửi nhắc nợ.</span>
          </div>
          {editing && (
            <div className="field span-2">
              <label htmlFor="f-col-status">Trạng thái</label>
              <select id="f-col-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FeeCollectionStatus })} disabled>
                {Object.entries(COLLECTION_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="hint">Đổi trạng thái bằng các nút Đóng / Mở lại / Hủy để có bước xác nhận.</span>
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
