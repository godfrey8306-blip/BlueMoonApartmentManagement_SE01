/**
 * NotificationBell — chuông thông báo ở header (nhân viên & cư dân).
 *  - Badge số chưa đọc, cập nhật mỗi 60 giây và khi quay lại tab.
 *  - Dropdown 8 thông báo mới nhất; bấm → đánh dấu đã đọc + mở trang liên quan.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { notificationsApi } from '../lib/services'
import { formatRelative } from '../lib/format'
import type { AppNotification } from '../types/models'

const ICONS: Record<string, string> = {
  FeeNotice: '📄',
  Reminder: '⏰',
  PaymentReceived: '✅',
  Payment: '💳',
  FeeCategory: '📂',
  FeeCollection: '🗂',
  FeeCharges: '💰',
  Account: '👤',
  System: 'ℹ️',
}

export function NotificationBell({ allLink }: { allLink: string }) {
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>()
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then(setCount)
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshCount()
    const timer = window.setInterval(refreshCount, 60_000)
    const onFocus = () => refreshCount()
    window.addEventListener('focus', onFocus)
    window.addEventListener('notifications:changed', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('notifications:changed', onFocus)
    }
  }, [refreshCount])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    notificationsApi
      .list({ page: 1, pageSize: 8 })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function openItem(n: AppNotification) {
    if (!n.isRead) {
      await notificationsApi.markRead(n.id).catch(() => undefined)
      setCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  async function markAll() {
    await notificationsApi.markAllRead().catch(() => undefined)
    setCount(0)
    setItems((list) => list?.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })))
  }

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="bell-button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Thông báo${count ? `, ${count} chưa đọc` : ''}`}
        aria-expanded={open}
      >
        🔔
        {count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="bell-panel" role="dialog" aria-label="Thông báo">
          <div className="bell-head">
            <strong>Thông báo</strong>
            {count > 0 && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={markAll}>
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          <div className="bell-list">
            {loading && !items && <div className="empty">Đang tải…</div>}
            {items?.length === 0 && <div className="empty">Chưa có thông báo nào.</div>}
            {items?.map((n) => (
              <button
                type="button"
                key={n.id}
                className={`bell-item sev-${n.severity} ${n.isRead ? '' : 'unread'}`}
                onClick={() => openItem(n)}
              >
                <span className="bell-icon" aria-hidden="true">
                  {ICONS[n.type] ?? '🔔'}
                </span>
                <span className="bell-body">
                  <span className="bell-title">{n.title}</span>
                  <span className="bell-msg">{n.message}</span>
                  <span className="bell-time">{formatRelative(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
          <Link to={allLink} className="bell-all" onClick={() => setOpen(false)}>
            Xem tất cả thông báo →
          </Link>
        </div>
      )}
    </div>
  )
}
