/**
 * AsyncCombobox — ô chọn "gõ để tìm" cho căn hộ / hộ / cư dân.
 * Chỉ tải tối đa 20 gợi ý mỗi lần gõ (GET /api/lookups/{kind}) → dùng được với hàng vạn bản ghi.
 * Hỗ trợ bàn phím: ↑ ↓ để chọn, Enter để xác nhận, Esc để đóng.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { lookupsApi, type Params } from '../lib/services'
import type { LookupItem, LookupKind } from '../types/models'

interface Props {
  kind: LookupKind
  value: number | null
  onChange: (item: LookupItem | null) => void
  label?: string
  placeholder?: string
  params?: Params
  disabled?: boolean
  required?: boolean
  id?: string
  /** Nhãn hiển thị ban đầu (tránh gọi API khi đã biết). */
  initialLabel?: string
  className?: string
}

export function AsyncCombobox({
  kind,
  value,
  onChange,
  label,
  placeholder = 'Gõ để tìm…',
  params,
  disabled,
  required,
  id,
  initialLabel,
  className,
}: Props) {
  const autoId = useId()
  const inputId = id ?? `cb-${autoId}`
  const listId = `${inputId}-list`
  const [text, setText] = useState(initialLabel ?? '')
  const [items, setItems] = useState<LookupItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [selectedLabel, setSelectedLabel] = useState(initialLabel ?? '')
  const wrapRef = useRef<HTMLDivElement>(null)
  const callId = useRef(0)
  const chosenId = useRef<number | null>(null)
  const paramsKey = JSON.stringify(params ?? {})

  // Giá trị được đặt từ bên ngoài → lấy nhãn tương ứng
  useEffect(() => {
    if (value == null) {
      setSelectedLabel('')
      setText('')
      return
    }
    if (value === chosenId.current) return
    if (initialLabel) {
      setSelectedLabel(initialLabel)
      setText(initialLabel)
      return
    }
    lookupsApi.search(kind, { id: value, limit: 1 }).then((r) => {
      if (r[0]) {
        setSelectedLabel(r[0].label)
        setText(r[0].label)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, kind])

  // Tìm gợi ý (debounce)
  useEffect(() => {
    if (!open) return
    const id = ++callId.current
    const q = text === selectedLabel ? '' : text.trim()
    setLoading(true)
    const t = window.setTimeout(() => {
      lookupsApi
        .search(kind, { ...params, q, limit: 20 })
        .then((r) => {
          if (id === callId.current) {
            setItems(r)
            setActive(0)
          }
        })
        .catch(() => id === callId.current && setItems([]))
        .finally(() => id === callId.current && setLoading(false))
    }, 250)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, open, kind, paramsKey])

  // Đóng khi bấm ra ngoài
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setText(selectedLabel)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [selectedLabel])

  function choose(item: LookupItem | null) {
    chosenId.current = item?.id ?? null
    setSelectedLabel(item?.label ?? '')
    setText(item?.label ?? '')
    setOpen(false)
    onChange(item)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (items[active]) choose(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setText(selectedLabel)
    }
  }

  return (
    <div className={`field combobox ${className ?? ''}`} ref={wrapRef}>
      {label && (
        <label htmlFor={inputId}>
          {label}
          {required && ' *'}
        </label>
      )}
      <div className="combobox-input">
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {value != null && !disabled && (
          <button type="button" className="combobox-clear" aria-label="Bỏ chọn" onClick={() => choose(null)}>
            ×
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul className="combobox-list" id={listId} role="listbox">
          {loading && items.length === 0 && <li className="combobox-empty">Đang tìm…</li>}
          {!loading && items.length === 0 && <li className="combobox-empty">Không tìm thấy kết quả.</li>}
          {items.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={item.id === value}
              className={`${i === active ? 'active' : ''} ${item.id === value ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(item)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <div className="fw-bold">{item.label}</div>
              {item.description && <div className="text-muted small">{item.description}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
