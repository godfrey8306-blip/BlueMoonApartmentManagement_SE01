/**
 * NotificationsPage.tsx — /notifications (nhân viên) và /portal/notifications (cư dân)
 */
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataState } from '../components/DataState'
import { Pagination } from '../components/DataTable'
import { SelectFilter } from '../components/Filters'
import { useListQuery } from '../hooks/useListQuery'
import { useUI } from '../context/UIContext'
import { notificationsApi } from '../lib/services'
import { formatDateTime, formatRelative } from '../lib/format'
import type { AppNotification } from '../types/models'

const SEVERITY_ICON: Record<string, string> = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '⛔' }

export function NotificationsPage() {
  const navigate = useNavigate()
  const { toast } = useUI()
  const list = useListQuery(['unreadOnly'] as const, (p) => notificationsApi.list(p))

  async function open(n: AppNotification) {
    if (!n.isRead) {
      await notificationsApi.markRead(n.id).catch(() => undefined)
      window.dispatchEvent(new Event('notifications:changed'))
    }
    if (n.link) navigate(n.link)
    else list.reload()
  }

  async function markAll() {
    await notificationsApi.markAllRead()
    window.dispatchEvent(new Event('notifications:changed'))
    toast.success('Đã đánh dấu tất cả là đã đọc.')
    list.reload()
  }

  return (
    <>
      <PageHeader
        title="Thông báo"
        description="Giấy báo phí, nhắc nợ, biên nhận thanh toán và các thay đổi nghiệp vụ liên quan đến bạn."
        action={
          <button type="button" className="btn btn-secondary" onClick={markAll}>
            ✓ Đánh dấu đã đọc tất cả
          </button>
        }
      />
      <div className="card">
        <div className="toolbar">
          <SelectFilter
            id="nt-unread"
            label="Hiển thị"
            value={list.filters.unreadOnly}
            onChange={(v) => list.setFilter('unreadOnly', v)}
            allLabel="Tất cả thông báo"
            options={[{ value: 'true', label: 'Chưa đọc' }]}
          />
        </div>
        <DataState loading={list.loading && !list.data} error={list.error} empty={!list.data?.items.length} emptyText="Không có thông báo nào." onRetry={list.reload}>
          {list.data?.items.map((n) => (
            <div key={n.id} className={`notif-row ${n.isRead ? '' : 'unread'}`}>
              <span style={{ fontSize: '1.2rem' }} aria-hidden="true">
                {SEVERITY_ICON[n.severity] ?? '🔔'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fw-bold">{n.title}</div>
                <div style={{ color: '#30455f', margin: '3px 0' }}>{n.message}</div>
                <div className="text-muted small" title={formatDateTime(n.createdAt)}>
                  {formatRelative(n.createdAt)} {n.isRead ? '· đã đọc' : '· chưa đọc'}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => open(n)}>
                {n.link ? 'Mở →' : 'Đã đọc'}
              </button>
            </div>
          ))}
        </DataState>
        {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
      </div>
    </>
  )
}
