/**
 * FeeCategoriesPage.tsx — Route: /fee-categories (C1, PBI-006 → PBI-010)
 * Danh mục khoản thu: phí dịch vụ, phí quản lý, đóng góp tự nguyện…
 * Backend kiểm tra trùng theo Name (không phân biệt hoa thường) — không có trường Code riêng.
 */
import { useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { DataState } from '../components/DataState'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { Feedback } from '../components/Feedback'
import { useAsync, useDebounced } from '../hooks/useAsync'
import { useUI } from '../context/UIContext'
import { feeCategoriesApi } from '../lib/services'
import { errorMessage } from '../lib/errors'
import { CALCULATION_METHODS, formatMoney, label } from '../lib/format'
import type { FeeCategory } from '../types/models'

interface FormState {
  name: string
  description: string
  unit: string
  unitPrice: string
  calculationMethod: string
  isMandatory: boolean
  isActive: boolean
}
const EMPTY: FormState = {
  name: '',
  description: '',
  unit: '',
  unitPrice: '0',
  calculationMethod: 'Fixed',
  isMandatory: true,
  isActive: true,
}

export function FeeCategoriesPage() {
  const { toast, confirm } = useUI()
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState('')
  const [kind, setKind] = useState('')
  const debouncedName = useDebounced(name)

  const { data, loading, error, reload } = useAsync(
    () =>
      feeCategoriesApi.list({
        name: debouncedName.trim() || undefined,
        isActive: isActive === '' ? undefined : isActive === 'true',
      }),
    [debouncedName, isActive],
  )
  const rows = (data ?? []).filter((c) => !kind || (kind === 'mandatory' ? c.isMandatory : !c.isMandatory))

  const [editing, setEditing] = useState<FeeCategory | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setFormError(undefined)
    setOpen(true)
  }

  function openEdit(c: FeeCategory) {
    setEditing(c)
    setForm({
      name: c.name,
      description: c.description ?? '',
      unit: c.unit,
      unitPrice: String(c.unitPrice),
      calculationMethod: c.calculationMethod,
      isMandatory: c.isMandatory,
      isActive: c.isActive,
    })
    setFormError(undefined)
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const unitPrice = Number(form.unitPrice)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit: form.unit.trim(),
      unitPrice,
      calculationMethod: form.calculationMethod.trim(),
      isMandatory: form.isMandatory,
    }
    if (!payload.name) return setFormError('Vui lòng nhập tên khoản thu.')
    if (payload.name.length > 100) return setFormError('Tên khoản thu tối đa 100 ký tự.')
    if (!payload.unit) return setFormError('Vui lòng nhập đơn vị tính.')
    if (form.unitPrice.trim() === '' || Number.isNaN(unitPrice)) return setFormError('Đơn giá không hợp lệ.')
    if (unitPrice < 0) return setFormError('Đơn giá không được âm.')
    if (!payload.calculationMethod) return setFormError('Vui lòng chọn cách tính.')
    const dup = (data ?? []).some((c) => c.id !== editing?.id && c.name.toLowerCase() === payload.name.toLowerCase())
    if (dup) return setFormError('Tên khoản thu đã tồn tại.')
    setFormError(undefined)

    // Thao tác nhạy cảm: tạo khoản thu mới / đổi đơn giá → xác nhận lại
    const priceChanged = editing && editing.unitPrice !== payload.unitPrice
    const deactivating = editing && editing.isActive && !form.isActive
    if (!editing || priceChanged || deactivating) {
      const ok = await confirm(
        editing ? `Lưu thay đổi cho khoản thu "${payload.name}"?` : `Tạo khoản thu mới "${payload.name}"?`,
        {
          title: editing ? 'Xác nhận cập nhật khoản thu' : 'Xác nhận tạo khoản thu',
          confirmText: editing ? 'Lưu thay đổi' : 'Tạo khoản thu',
          details: [
            ['Tên khoản thu', payload.name],
            [
              'Đơn giá',
              priceChanged ? `${formatMoney(editing!.unitPrice)} → ${formatMoney(payload.unitPrice)} / ${payload.unit}` : `${formatMoney(payload.unitPrice)} / ${payload.unit}`,
            ],
            ['Cách tính', label(CALCULATION_METHODS, payload.calculationMethod)],
            ['Phân loại', payload.isMandatory ? 'Bắt buộc' : 'Tự nguyện'],
            ...(deactivating ? ([['Trạng thái', 'Ngừng áp dụng']] as [string, string][]) : []),
          ],
          warning: priceChanged
            ? 'Đơn giá mới chỉ áp dụng cho khoản phải thu sinh SAU thời điểm này; các khoản đã lập giữ nguyên. Ban quản trị và kế toán khác sẽ nhận được thông báo.'
            : editing
              ? undefined
              : 'Khoản thu bắt buộc sẽ được dùng để lập danh sách phải thu cho mọi căn hộ trong các đợt thu.',
        },
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      if (editing) {
        await feeCategoriesApi.update(editing.id, { ...payload, isActive: form.isActive })
        toast.success(`Đã cập nhật khoản thu "${payload.name}".`)
      } else {
        await feeCategoriesApi.create(payload)
        toast.success(`Đã tạo khoản thu "${payload.name}".`)
      }
      setOpen(false)
      reload()
    } catch (err) {
      setFormError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(c: FeeCategory) {
    const ok = await confirm(`Ngừng áp dụng khoản thu "${c.name}"?`, {
      title: 'Ngừng áp dụng khoản thu',
      confirmText: 'Ngừng áp dụng',
      danger: true,
      details: [
        ['Khoản thu', c.name],
        ['Đơn giá', `${formatMoney(c.unitPrice)} / ${c.unit}`],
      ],
      warning: 'Khoản thu sẽ không dùng được khi lập danh sách phải thu mới. Các khoản đã lập vẫn giữ nguyên và vẫn thu được.',
      onConfirm: () => feeCategoriesApi.deactivate(c.id),
    })
    if (!ok) return
    toast.success(`Đã ngừng áp dụng "${c.name}".`)
    reload()
  }

  async function handleDelete(c: FeeCategory) {
    const ok = await confirm(`Xóa vĩnh viễn khoản thu "${c.name}"?`, {
      title: 'Xóa khoản thu',
      danger: true,
      confirmText: 'Xóa vĩnh viễn',
      requireText: 'XOA',
      warning: 'Chỉ xóa được khoản thu chưa từng được lập cho căn hộ nào. Nếu đã dùng, hãy "Ngừng áp dụng".',
      onConfirm: () => feeCategoriesApi.remove(c.id),
    })
    if (!ok) return
    toast.success(`Đã xóa "${c.name}".`)
    reload()
  }

  return (
    <>
      <PageHeader
        title="Danh mục Khoản thu"
        description="Khai báo phí dịch vụ, phí quản lý và các khoản đóng góp tự nguyện."
        action={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Thêm khoản thu
          </button>
        }
      />

      <div className="card">
        <div className="toolbar">
          <div className="field field-grow">
            <label htmlFor="fc-name">Tên khoản thu</label>
            <input id="fc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tìm theo tên…" />
          </div>
          <div className="field">
            <label htmlFor="fc-kind">Loại</label>
            <select id="fc-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="mandatory">Bắt buộc</option>
              <option value="voluntary">Tự nguyện</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="fc-active">Trạng thái</label>
            <select id="fc-active" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="true">Đang áp dụng</option>
              <option value="false">Ngừng áp dụng</option>
            </select>
          </div>
        </div>

        <DataState
          loading={loading}
          error={error}
          empty={rows.length === 0}
          emptyText="Chưa có khoản thu nào."
          onRetry={reload}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên khoản thu</th>
                  <th>Mô tả</th>
                  <th>Đơn vị</th>
                  <th className="text-right">Đơn giá</th>
                  <th>Cách tính</th>
                  <th>Loại</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="fw-bold">{c.name}</td>
                    <td className="wrap text-muted">{c.description || '—'}</td>
                    <td>{c.unit}</td>
                    <td className="text-right">{formatMoney(c.unitPrice)}</td>
                    <td>{label(CALCULATION_METHODS, c.calculationMethod)}</td>
                    <td>
                      <StatusBadge
                        value={c.isMandatory ? 'mandatory' : 'voluntary'}
                        label={c.isMandatory ? 'Bắt buộc' : 'Tự nguyện'}
                        tone={c.isMandatory ? 'info' : 'muted'}
                      />
                    </td>
                    <td>
                      <StatusBadge
                        value={c.isActive ? 'Active' : 'Inactive'}
                        label={c.isActive ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                      />
                    </td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                          Sửa
                        </button>
                        {c.isActive && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeactivate(c)}>
                            Ngừng
                          </button>
                        )}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>

      <Modal
        open={open}
        size="lg"
        title={editing ? `Sửa khoản thu: ${editing.name}` : 'Thêm khoản thu'}
        onClose={() => !saving && setOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={saving}>
              Hủy
            </button>
            <button type="submit" form="fee-category-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        }
      >
        <Feedback error={formError} />
        {editing && (
          <div className="alert alert-info">
            Thay đổi đơn giá chỉ áp dụng cho khoản phải thu tạo mới; các khoản đã sinh giữ nguyên đơn giá cũ.
          </div>
        )}
        <form id="fee-category-form" className="form-grid" onSubmit={handleSubmit} noValidate>
          <div className="field span-2">
            <label htmlFor="f-fc-name">Tên khoản thu *</label>
            <input
              id="f-fc-name"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VD: Phí quản lý chung cư"
              autoFocus
            />
          </div>
          <div className="field span-2">
            <label htmlFor="f-fc-desc">Mô tả / mục đích</label>
            <textarea
              id="f-fc-desc"
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="f-fc-unit">Đơn vị tính *</label>
            <input
              id="f-fc-unit"
              list="unit-options"
              maxLength={50}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              placeholder="VD: m², căn hộ, người"
            />
            <datalist id="unit-options">
              <option value="m²" />
              <option value="căn hộ" />
              <option value="người" />
              <option value="tháng" />
              <option value="lần" />
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="f-fc-price">Đơn giá (VNĐ) *</label>
            <input
              id="f-fc-price"
              type="number"
              min={0}
              step="any"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            />
            <span className="hint">{formatMoney(Number(form.unitPrice) || 0)}</span>
          </div>
          <div className="field">
            <label htmlFor="f-fc-method">Cách tính *</label>
            <select
              id="f-fc-method"
              value={form.calculationMethod}
              onChange={(e) => setForm({ ...form, calculationMethod: e.target.value })}
            >
              {Object.entries(CALCULATION_METHODS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              {form.calculationMethod && !CALCULATION_METHODS[form.calculationMethod] && (
                <option value={form.calculationMethod}>{form.calculationMethod}</option>
              )}
            </select>
          </div>
          <div className="field">
            <label>Phân loại</label>
            <div style={{ display: 'flex', gap: 18, paddingTop: 8 }}>
              <label className="check">
                <input
                  type="radio"
                  name="mandatory"
                  checked={form.isMandatory}
                  onChange={() => setForm({ ...form, isMandatory: true })}
                />
                Bắt buộc
              </label>
              <label className="check">
                <input
                  type="radio"
                  name="mandatory"
                  checked={!form.isMandatory}
                  onChange={() => setForm({ ...form, isMandatory: false })}
                />
                Tự nguyện
              </label>
            </div>
          </div>
          {editing && (
            <label className="check span-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Đang áp dụng
            </label>
          )}
        </form>
      </Modal>
    </>
  )
}
