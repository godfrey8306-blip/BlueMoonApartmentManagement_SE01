import type { ReactNode } from 'react'

export function Loading({ text = 'Đang tải dữ liệu…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {text}
    </div>
  )
}

interface DataStateProps {
  loading: boolean
  error?: string
  empty: boolean
  emptyText?: string
  onRetry?: () => void
  children: ReactNode
}

/** Hiển thị đúng 1 trong 4 trạng thái bắt buộc: Loading / Error / Empty / Data. */
export function DataState({ loading, error, empty, emptyText = 'Không có dữ liệu.', onRetry, children }: DataStateProps) {
  if (loading) return <Loading />
  if (error) {
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
  if (empty) return <div className="empty">{emptyText}</div>
  return <>{children}</>
}
