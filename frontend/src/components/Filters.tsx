/**
 * Thành phần bộ lọc dùng chung cho các trang danh sách lớn.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { lookupsApi } from '../lib/services'

/** Ô tìm kiếm có debounce — chỉ gọi onChange sau khi ngừng gõ. */
export function SearchInput({
  id,
  label = 'Tìm kiếm',
  value,
  onChange,
  placeholder,
  delay = 350,
  autoFocus,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
  autoFocus?: boolean
}) {
  const [text, setText] = useState(value)
  const last = useRef(value)

  // Đồng bộ khi giá trị bên ngoài đổi (vd. bấm "Xóa lọc", nút Back)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (text === last.current) return
    const t = window.setTimeout(() => {
      last.current = text.trim()
      onChange(text.trim())
    }, delay)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <div className="field field-grow">
      <label htmlFor={id}>{label}</label>
      <div className="input-icon">
        <span aria-hidden="true">🔍</span>
        <input
          id={id}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  )
}

export interface Option {
  value: string
  label: string
}

export function SelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = 'Tất cả',
  minWidth,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  allLabel?: string
  minWidth?: number
}) {
  return (
    <div className="field" style={minWidth ? { minWidth } : undefined}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

let buildingCache: Promise<string[]> | null = null

/** Danh sách tòa nhà (tải một lần, dùng chung). */
export function useBuildings(): string[] {
  const [buildings, setBuildings] = useState<string[]>([])
  useEffect(() => {
    buildingCache ??= lookupsApi.buildings().catch(() => {
      buildingCache = null
      return []
    })
    buildingCache.then(setBuildings)
  }, [])
  return buildings
}

export function BuildingFilter({ value, onChange, id = 'f-building' }: { value: string; onChange: (v: string) => void; id?: string }) {
  const buildings = useBuildings()
  return (
    <SelectFilter
      id={id}
      label="Tòa nhà"
      value={value}
      onChange={onChange}
      options={buildings.map((b) => ({ value: b, label: `Tòa ${b}` }))}
      minWidth={120}
    />
  )
}

/** Thanh công cụ lọc: hàng lọc nhanh + phần "Lọc nâng cao" thu gọn được. */
export function FilterBar({
  children,
  advanced,
  activeCount,
  onClear,
  extra,
}: {
  children: ReactNode
  advanced?: ReactNode
  activeCount: number
  onClear: () => void
  extra?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="filter-bar">
      <div className="toolbar mb-0">
        {children}
        <div className="filter-actions">
          {advanced && (
            <button type="button" className={`btn btn-sm ${open ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setOpen((o) => !o)}>
              ⚙ Lọc nâng cao {open ? '▴' : '▾'}
            </button>
          )}
          {activeCount > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
              ✕ Xóa lọc ({activeCount})
            </button>
          )}
          {extra}
        </div>
      </div>
      {advanced && open && <div className="toolbar toolbar-advanced">{advanced}</div>}
    </div>
  )
}
