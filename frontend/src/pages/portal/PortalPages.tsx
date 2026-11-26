/**
 * Cổng cư dân (role Resident) — chỉ xem dữ liệu của hộ mình.
 *   /portal            Tổng quan: còn nợ, quá hạn, hạn gần nhất, thông báo mới
 *   /portal/charges    Khoản phí theo kỳ (lọc còn nợ / quá hạn)
 *   /portal/payments   Lịch sử đóng tiền + xem/in biên nhận
 *   /portal/notices    Giấy báo phí & nhắc nợ (in được)
 *   /portal/household  Thông tin hộ & thành viên
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { DataState } from '../../components/DataState'
import { Pagination } from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { StatusBadge } from '../../components/StatusBadge'
import { ChargeStatus } from '../../components/FeeBadges'
import { useAsync } from '../../hooks/useAsync'
import { useListQuery } from '../../hooks/useListQuery'
import { notificationsApi, portalApi } from '../../lib/services'
import { RESIDENT_STATUS_LABELS, ageOf, formatDate, formatDateTime, formatMoney, formatNumber, formatRelative, label } from '../../lib/format'
import { NoticeSheet } from '../FeeNoticesPage'
import { ReceiptView } from '../PaymentsPage'
import type { Payment } from '../../types/models'

export function PortalHomePage() {
  const summary = useAsync(() => portalApi.summary(), [])
  const notices = useAsync(() => notificationsApi.list({ page: 1, pageSize: 5 }), [])
  const overdue = useAsync(() => portalApi.charges({ overdue: true, page: 1, pageSize: 10 }), [])
  const s = summary.data

  return (
    <>
      <DataState loading={summary.loading} error={summary.error} empty={!s} onRetry={summary.reload}>
        {s && (
          <div className={`portal-hero mb-20 ${s.overdueAmount > 0 ? 'has-overdue' : ''}`}>
            <div style={{ opacity: 0.9 }}>
              Căn hộ {s.apartmentCode} · Tòa {s.building} · Hộ {s.householdCode}
            </div>
            <div className="amount">{formatMoney(s.outstandingAmount)}</div>
            <div>
              {s.outstandingAmount === 0
                ? 'Hộ của bạn đã hoàn thành nghĩa vụ đóng phí. Cảm ơn bạn! 🎉'
                : s.overdueAmount > 0
                  ? `⚠️ Có ${s.overdueChargeCount} khoản đã QUÁ HẠN (${formatMoney(s.overdueAmount)}). Vui lòng thanh toán sớm.`
                  : `Còn ${s.unpaidChargeCount} khoản chưa đóng${s.nextDueDate ? ` · hạn gần nhất ${formatDate(s.nextDueDate)} (${formatMoney(s.nextDueAmount)})` : ''}.`}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/portal/charges?outstanding=true" className="btn btn-secondary btn-sm">
                Xem khoản cần đóng
              </Link>
              <Link to="/portal/notices" className="btn btn-ghost btn-sm" style={{ color: '#fff' }}>
                Giấy báo phí →
              </Link>
            </div>
          </div>
        )}
      </DataState>

      {s && (
        <div className="grid grid-2 mb-20" style={{ gap: 12 }}>
          <div className="card stat-card tone-success">
            <div className="stat-label">Đã đóng năm nay</div>
            <div className="stat-value">{formatMoney(s.paidThisYear)}</div>
          </div>
          <Link to="/portal/notifications" className="card stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="stat-label">Thông báo chưa đọc</div>
            <div className="stat-value">{s.unreadNotificationCount}</div>
          </Link>
        </div>
      )}

      {overdue.data && overdue.data.items.length > 0 && (
        <div className="card mb-20">
          <h3 className="section-title text-danger">Khoản quá hạn</h3>
          {overdue.data.items.map((c) => (
            <div key={c.id} className="charge-card overdue">
              <div>
                <div className="fw-bold">
                  {c.feeCategoryName} · kỳ {String(c.feeCollectionMonth).padStart(2, '0')}/{c.feeCollectionYear}
                </div>
                <div className="text-danger small">
                  Hạn {formatDate(c.dueDate)} — quá hạn {c.daysOverdue} ngày
                </div>
              </div>
              <div className="fw-bold text-danger">{formatMoney(c.outstandingAmount)}</div>
            </div>
          ))}
          <p className="text-muted small mb-0 mt-16">Vui lòng nộp tại văn phòng Ban quản trị hoặc chuyển khoản, ghi rõ mã căn hộ {s?.apartmentCode}.</p>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title mb-0">Thông báo mới</h3>
          <Link to="/portal/notifications" className="btn btn-ghost btn-sm">
            Tất cả →
          </Link>
        </div>
        <DataState loading={notices.loading} error={notices.error} empty={!notices.data?.items.length} emptyText="Chưa có thông báo nào.">
          {notices.data?.items.map((n) => (
            <div key={n.id} className={`notif-row ${n.isRead ? '' : 'unread'}`}>
              <div style={{ flex: 1 }}>
                <div className="fw-bold">{n.title}</div>
                <div style={{ color: '#30455f', margin: '3px 0' }}>{n.message}</div>
                <div className="text-muted small">{formatRelative(n.createdAt)}</div>
              </div>
            </div>
          ))}
        </DataState>
      </div>
    </>
  )
}

export function PortalChargesPage() {
  const list = useListQuery(['outstanding', 'overdue', 'year'] as const, (p) => portalApi.charges(p), { pageSize: 20 })
  const { filters, setFilters } = list
  const view = filters.overdue ? 'overdue' : filters.outstanding ? 'outstanding' : ''

  return (
    <>
      <PageHeader title="Khoản phí của hộ" description="Các khoản phải đóng theo từng kỳ thu, hạn nộp và tình trạng thanh toán." />
      <div className="quick-filters">
        {[
          { v: '', l: 'Tất cả' },
          { v: 'outstanding', l: 'Còn phải đóng' },
          { v: 'overdue', l: 'Quá hạn', tone: 'danger' },
        ].map((x) => (
          <button
            key={x.v}
            type="button"
            className={`quick-filter ${x.tone ? `tone-${x.tone}` : ''} ${view === x.v ? 'active' : ''}`}
            onClick={() => setFilters({ outstanding: x.v === 'outstanding' ? 'true' : '', overdue: x.v === 'overdue' ? 'true' : '' })}
          >
            {x.l}
          </button>
        ))}
      </div>
      <DataState loading={list.loading && !list.data} error={list.error} empty={!list.data?.items.length} emptyText={view ? 'Không có khoản nào. 🎉' : 'Chưa có khoản phí nào.'} onRetry={list.reload}>
        {list.data?.items.map((c) => (
          <div key={c.id} className={`charge-card ${c.isOverdue ? 'overdue' : ''}`}>
            <div style={{ minWidth: 0 }}>
              <div className="fw-bold">
                {c.feeCategoryName} · kỳ {String(c.feeCollectionMonth).padStart(2, '0')}/{c.feeCollectionYear}
              </div>
              <div className="text-muted small">
                {formatNumber(c.quantity)} {c.feeCategoryUnit} × {formatMoney(c.unitPrice)} · hạn {formatDate(c.dueDate)}
              </div>
              <div style={{ marginTop: 4 }}>
                <ChargeStatus charge={c} />
              </div>
            </div>
            <div className="text-right">
              <div className="fw-bold">{formatMoney(c.totalAmount)}</div>
              {c.paidAmount > 0 && <div className="text-success small">Đã đóng {formatMoney(c.paidAmount)}</div>}
              {c.outstandingAmount > 0 && <div className="text-danger small fw-bold">Còn {formatMoney(c.outstandingAmount)}</div>}
            </div>
          </div>
        ))}
      </DataState>
      {list.data && list.data.total > list.pageSize && (
        <div className="mt-16">
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} />
        </div>
      )}
    </>
  )
}

export function PortalPaymentsPage() {
  const list = useListQuery([] as const, (p) => portalApi.payments(p))
  const [viewing, setViewing] = useState<Payment | null>(null)

  return (
    <>
      <PageHeader title="Lịch sử đóng tiền" description="Các phiếu thu Ban quản trị đã ghi nhận cho hộ của bạn." />
      <DataState loading={list.loading && !list.data} error={list.error} empty={!list.data?.items.length} emptyText="Chưa có phiếu thu nào." onRetry={list.reload}>
        {list.data?.items.map((p) => (
          <div key={p.id} className="charge-card">
            <div style={{ minWidth: 0 }}>
              <div className="fw-bold">Phiếu thu {p.receiptNumber}</div>
              <div className="text-muted small">
                {formatDateTime(p.paymentDate)} · {p.paymentMethod}
              </div>
              <div className="small">{p.details.map((d) => d.feeCategoryName).join(', ')}</div>
            </div>
            <div className="text-right">
              <div className="fw-bold text-success">{formatMoney(p.totalAmount)}</div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewing(p)}>
                Xem biên nhận
              </button>
            </div>
          </div>
        ))}
      </DataState>
      {list.data && list.data.total > list.pageSize && (
        <div className="mt-16">
          <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} />
        </div>
      )}
      <Modal
        open={Boolean(viewing)}
        title={viewing ? `Biên nhận ${viewing.receiptNumber}` : ''}
        onClose={() => setViewing(null)}
        footer={
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            🖨 In biên nhận
          </button>
        }
      >
        {viewing && <ReceiptView payment={viewing} />}
      </Modal>
    </>
  )
}

export function PortalNoticesPage() {
  const [type, setType] = useState('')
  const notices = useAsync(() => portalApi.notices({ type: type || undefined }), [type])
  const [open, setOpen] = useState<number | null>(null)

  return (
    <>
      <div className="no-print">
        <PageHeader title="Giấy báo phí & nhắc nợ" description="Giấy báo Ban quản trị gửi cho hộ của bạn theo từng kỳ thu." />
        <div className="quick-filters">
          {[
            { v: '', l: 'Tất cả' },
            { v: 'Notice', l: 'Giấy báo phí' },
            { v: 'Reminder', l: 'Nhắc nợ', tone: 'danger' },
          ].map((x) => (
            <button key={x.v} type="button" className={`quick-filter ${x.tone ? `tone-${x.tone}` : ''} ${type === x.v ? 'active' : ''}`} onClick={() => setType(x.v)}>
              {x.l}
            </button>
          ))}
        </div>
      </div>
      <DataState loading={notices.loading} error={notices.error} empty={!notices.data?.length} emptyText="Chưa có giấy báo nào." onRetry={notices.reload}>
        {notices.data?.map((n) => (
          <div key={n.id} className="no-print">
            <div className={`charge-card ${n.type === 'Reminder' ? 'overdue' : ''}`}>
              <div>
                <div className="fw-bold">
                  {n.type === 'Reminder' ? '⏰ Nhắc nợ' : '📄 Giấy báo phí'} kỳ {String(n.month).padStart(2, '0')}/{n.year}
                </div>
                <div className="text-muted small">
                  Phát hành {formatDate(n.issuedAt)} · hạn nộp {formatDate(n.dueDate)}
                </div>
              </div>
              <div className="text-right">
                <div className="fw-bold">{formatMoney(n.type === 'Reminder' ? n.outstandingAmount : n.totalAmount)}</div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === n.id ? null : n.id)}>
                  {open === n.id ? 'Thu gọn' : 'Xem chi tiết'}
                </button>
              </div>
            </div>
            {open === n.id && (
              <div className="printable" style={{ marginTop: 10 }}>
                <NoticeSheet notice={n} />
                <button type="button" className="btn btn-secondary btn-sm no-print" onClick={() => window.print()}>
                  🖨 In giấy báo
                </button>
              </div>
            )}
          </div>
        ))}
      </DataState>
    </>
  )
}

export function PortalHouseholdPage() {
  const household = useAsync(() => portalApi.household(), [])
  const h = household.data

  return (
    <>
      <PageHeader title="Hộ gia đình của tôi" description="Thông tin hộ và các thành viên đang đăng ký cư trú. Liên hệ Ban quản trị nếu cần điều chỉnh." />
      <DataState loading={household.loading} error={household.error} empty={!h} onRetry={household.reload}>
        {h && (
          <>
            <div className="card mb-20">
              <dl className="detail-list">
                <dt>Mã hộ</dt>
                <dd>{h.householdCode}</dd>
                <dt>Căn hộ</dt>
                <dd>
                  {h.apartmentCode} · Tòa {h.building} · Tầng {h.floor}
                </dd>
                <dt>Diện tích</dt>
                <dd>{formatNumber(h.area)} m²</dd>
                <dt>Ngày đăng ký</dt>
                <dd>{formatDate(h.createdAt)}</dd>
              </dl>
            </div>
            <div className="card">
              <h3 className="section-title">Thành viên ({h.members.length})</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>Quan hệ</th>
                      <th>Ngày sinh</th>
                      <th>Giới tính</th>
                      <th>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.members.map((m) => (
                      <tr key={m.id}>
                        <td className="fw-bold">
                          {m.fullName}
                          {m.isHouseholdHead && (
                            <span className="badge badge-info" style={{ marginLeft: 6 }}>
                              Chủ hộ
                            </span>
                          )}
                        </td>
                        <td>{m.relationship || '—'}</td>
                        <td>
                          {formatDate(m.dateOfBirth)} {ageOf(m.dateOfBirth) !== null && <span className="text-muted small">({ageOf(m.dateOfBirth)} t)</span>}
                        </td>
                        <td>{m.gender || '—'}</td>
                        <td>
                          <StatusBadge value={m.status} label={label(RESIDENT_STATUS_LABELS, m.status)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </DataState>
    </>
  )
}
