/**
 * DataTable + Pagination — bảng dữ liệu phân trang phía server.
 *  - Bấm tiêu đề cột có sortKey để sắp xếp (bấm lần 2 đảo chiều).
 *  - Giữ dữ liệu cũ + lớp phủ mờ khi đang tải trang mới (không nhảy layout).
 */
import type { ReactNode } from 'react'
import { Loading } from './DataState'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  sortKey?: string
  align?: 'right' | 'center'
  className?: string
  width?: number | string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading: boolean
  error?: string
  onRetry?: () => void
  emptyText?: string
  sort?: string
  onSort?: (sort: string) => void
  footer?: ReactNode
  rowClassName?: (row: T) => string | undefined
  /** Chọn nhiều dòng */
  selectable?: boolean
  selected?: Set<string | number>
  onSelectedChange?: (next: Set<string | number>) => void
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyText = 'Không có dữ liệu phù hợp.',
  sort,
  onSort,
  footer,
  rowClassName,
  selectable,
  selected,
  onSelectedChange,
}: DataTableProps<T>) {
  if (!rows && loading) return <Loading />
  if (error && !rows) {
    return (
      <div className="empty">
        <div className="text-danger" style={{ marginBottom: 12 }}>
          ⚠️ {error}
        </div>
        {onRetry && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    )
  }
  if (!rows || rows.length === 0) return <div className="empty">{loading ? 'Đang tải…' : emptyText}</div>

  const desc = sort?.startsWith('-')
  const sortField = sort?.replace(/^-/, '')
  const allKeys = rows.map(rowKey)
  const allSelected = selectable && allKeys.length > 0 && allKeys.every((k) => selected?.has(k))

  function toggleAll() {
    const next = new Set(selected)
    if (allSelected) allKeys.forEach((k) => next.delete(k))
    else allKeys.forEach((k) => next.add(k))
    onSelectedChange?.(next)
  }

  function toggle(k: string | number) {
    const next = new Set(selected)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onSelectedChange?.(next)
  }

  return (
    <div className={`table-wrap table-sticky ${loading ? 'is-loading' : ''}`}>
      {error && <div className="alert alert-error mb-0">{error}</div>}
      <table>
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: 36 }}>
                <input type="checkbox" aria-label="Chọn tất cả trên trang" checked={!!allSelected} onChange={toggleAll} />
              </th>
            )}
            {columns.map((c) => {
              const active = c.sortKey && sortField === c.sortKey
              const align = c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''
              return (
                <th key={c.key} className={align} style={c.width ? { width: c.width } : undefined}>
                  {c.sortKey && onSort ? (
                    <button
                      type="button"
                      className={`th-sort ${active ? 'active' : ''}`}
                      onClick={() => onSort(active && !desc ? `-${c.sortKey}` : active && desc ? '' : c.sortKey!)}
                      title="Sắp xếp"
                    >
                      {c.header}
                      <span className="sort-icon">{active ? (desc ? '▼' : '▲') : '↕'}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row)
            return (
              <tr key={k} className={rowClassName?.(row)}>
                {selectable && (
                  <td>
                    <input type="checkbox" aria-label="Chọn dòng" checked={selected?.has(k) ?? false} onChange={() => toggle(k)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={[c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : '', c.className ?? '']
                      .join(' ')
                      .trim()}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize?: (size: number) => void
  sizes?: number[]
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [20, 50, 100] }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  // Dãy số trang rút gọn: 1 … 4 5 [6] 7 8 … 20
  const nums: (number | '…')[] = []
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 2) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }

  return (
    <div className="pagination">
      <span className="text-muted">
        {from.toLocaleString('vi-VN')}–{to.toLocaleString('vi-VN')} / <strong>{total.toLocaleString('vi-VN')}</strong> dòng
      </span>
      <div className="pagination-pages">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          ‹
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="text-muted" style={{ padding: '0 4px' }}>
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onPage(n)}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          ›
        </button>
      </div>
      {onPageSize && (
        <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Hiển thị
          <select className="select-sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          dòng
        </label>
      )}
    </div>
  )
}
