/**
 * GlobalSearch — ô tìm kiếm toàn hệ thống ở header (phím tắt Ctrl+K / ⌘K).
 * Tìm căn hộ, hộ gia đình, cư dân (không dấu, CCCD, SĐT) và phiếu thu.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../lib/services'
import type { GlobalSearchItem } from '../types/models'

const GROUPS: Record<GlobalSearchItem['type'], { label: string; icon: string }> = {
  apartment: { label: 'Căn hộ', icon: '🏢' },
  household: { label: 'Hộ gia đình', icon: '🏘' },
  resident: { label: 'Cư dân', icon: '👤' },
  payment: { label: 'Phiếu thu', icon: '🧾' },
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [items, setItems] = useState<GlobalSearchItem[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const callId = useRef(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDoc)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setItems([])
      setLoading(false)
      return
    }
    const id = ++callId.current
    setLoading(true)
    const t = window.setTimeout(() => {
      globalSearch(term)
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
  }, [q])

  function go(item: GlobalSearchItem) {
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
    navigate(item.link)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      go(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  let index = -1
  const grouped = (Object.keys(GROUPS) as GlobalSearchItem['type'][])
    .map((type) => ({ type, rows: items.filter((i) => i.type === type) }))
    .filter((g) => g.rows.length > 0)

  return (
    <div className="global-search" ref={wrapRef}>
      <span className="global-search-icon" aria-hidden="true">
        🔍
      </span>
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Tìm căn hộ, cư dân, CCCD, SĐT, phiếu thu…"
        aria-label="Tìm kiếm toàn hệ thống"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <kbd className="kbd">Ctrl K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="global-search-panel" role="listbox">
          {loading && items.length === 0 && <div className="empty">Đang tìm…</div>}
          {!loading && items.length === 0 && <div className="empty">Không tìm thấy kết quả cho “{q.trim()}”.</div>}
          {grouped.map((g) => (
            <div key={g.type}>
              <div className="gs-group">
                {GROUPS[g.type].icon} {GROUPS[g.type].label}
              </div>
              {g.rows.map((item) => {
                index++
                const i = index
                return (
                  <button
                    type="button"
                    key={`${item.type}-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    className={`gs-item ${i === active ? 'active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      go(item)
                    }}
                  >
                    <span className="fw-bold">{item.title}</span>
                    {item.subtitle && <span className="text-muted small">{item.subtitle}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
