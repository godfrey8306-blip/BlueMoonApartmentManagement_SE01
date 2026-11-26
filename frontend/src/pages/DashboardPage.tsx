/**
 * DashboardPage.tsx — / (D3 · PBI-015, 018, 019, 020 / US-011, US-012)
 *  - Cảnh báo việc cần làm: khoản quá hạn, sắp đến hạn, đợt thu chưa phát hành giấy báo / đã quá hạn.
 *  - Cư dân: tổng căn, hộ, nhân khẩu (đếm phía server).
 *  - Tài chính: phải thu / đã thu / còn nợ / quá hạn; doanh thu theo tháng-quý-năm (ngày thu thực tế);
 *    tuổi nợ + căn quá hạn nhiều nhất (nhắc nợ ngay).
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataState } from '../components/DataState'
import { StatusBadge } from '../components/StatusBadge'
import { BuildingFilter } from '../components/Filters'
import { useAsync } from '../hooks/useAsync'
import { useAuth } from '../context/AuthContext'
import { useUI } from '../context/UIContext'
import { apartmentsApi, feeChargesApi, householdsApi, notificationsApi, residentsApi, searchApi } from '../lib/services'
import { COLLECTION_STATUS_LABELS, ROLE_LABELS, formatDate, formatMoney, formatPercent, formatRelative, label } from '../lib/format'

type Period = 'month' | 'quarter' | 'year'

function compactMoney(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} tỷ`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} tr`
  if (v >= 1e3) return `${Math.round(v / 1e3)}k`
  return String(v)
}

export function DashboardPage() {
  const { user } = useAuth()
  const { toast, confirm } = useUI()
  const [building, setBuilding] = useState('')
  const [period, setPeriod] = useState<Period>('month')

  const counts = useAsync(
    async () => {
      const [apts, occupied, hh, res, absent, temp] = await Promise.all([
        apartmentsApi.list({ page: 1, pageSize: 1, building }),
        apartmentsApi.list({ page: 1, pageSize: 1, building, status: 'Occupied' }),
        householdsApi.list({ page: 1, pageSize: 1, building, isActive: true }),
        residentsApi.list({ page: 1, pageSize: 1, building, status: 'Active,TemporaryResident,TemporarilyAbsent' }),
        residentsApi.list({ page: 1, pageSize: 1, building, status: 'TemporarilyAbsent' }),
        residentsApi.list({ page: 1, pageSize: 1, building, status: 'TemporaryResident' }),
      ])
      return { apts: apts.total, occupied: occupied.total, households: hh.total, residents: res.total, absent: absent.total, temp: temp.total }
    },
    [building],
  )
  const financial = useAsync(() => searchApi.financialStats({ building }), [building])
  const alerts = useAsync(() => notificationsApi.alerts(), [])
  const revenue = useAsync(() => searchApi.revenue({ groupBy: period }), [period])
  const aging = useAsync(() => searchApi.aging({ building, top: 8 }), [building])
  const collections = useAsync(() => searchApi.collectionStats(), [])
  const f = financial.data
  const a = alerts.data
  const maxRevenue = Math.max(1, ...(revenue.data?.buckets.map((b) => b.amount) ?? [0]))

  async function remindApartment(apartmentId: number, code: string) {
    let notified = 0
    const ok = await confirm(`Gửi nhắc nợ quá hạn cho căn ${code}?`, {
      title: 'Gửi nhắc nợ',
      confirmText: 'Gửi nhắc nợ',
      onConfirm: async () => {
        notified = (await feeChargesApi.remind({ apartmentIds: [apartmentId] })).notifiedAccountCount
      },
    })
    if (ok) {
      toast.success(`Đã gửi nhắc nợ căn ${code}${notified ? ` (${notified} tài khoản cư dân nhận thông báo)` : ' — căn chưa có tài khoản cư dân, hãy in giấy nhắc nợ.'}`)
      aging.reload()
    }
  }

  const tasks = [
    a && a.overdueChargeCount > 0 && (
      <Link key="o" to="/fee-charges?view=overdue" className="alert-card danger">
        <span className="big">⏰</span>
        <div>
          <div className="fw-bold">{a.overdueApartmentCount} căn hộ có khoản quá hạn</div>
          <div className="text-muted small">
            {a.overdueChargeCount} khoản · <strong className="text-danger">{formatMoney(a.overdueAmount)}</strong> — xem & gửi nhắc nợ
          </div>
        </div>
      </Link>
    ),
    a && a.dueSoonChargeCount > 0 && (
      <Link key="s" to="/fee-charges?view=dueSoon" className="alert-card warning">
        <span className="big">📅</span>
        <div>
          <div className="fw-bold">{a.dueSoonChargeCount} khoản sắp đến hạn trong 7 ngày</div>
          <div className="text-muted small">Tổng {formatMoney(a.dueSoonAmount)} chưa thu</div>
        </div>
      </Link>
    ),
    ...(a?.openCollectionsWithoutNotice ?? []).map((c) => (
      <Link key={`n${c.id}`} to="/fee-collections" className="alert-card info">
        <span className="big">📄</span>
        <div>
          <div className="fw-bold">{c.name}: chưa phát hành giấy báo phí</div>
          <div className="text-muted small">
            {c.chargeCount} khoản đã lập · hạn {formatDate(c.dueDate)}
          </div>
        </div>
      </Link>
    )),
    ...(a?.openCollectionsPastDue ?? []).map((c) => (
      <Link key={`p${c.id}`} to="/fee-collections" className="alert-card warning">
        <span className="big">🗂</span>
        <div>
          <div className="fw-bold">{c.name} đã quá hạn nộp nhưng vẫn đang mở</div>
          <div className="text-muted small">Còn nợ {formatMoney(c.outstandingAmount)} — cân nhắc đóng đợt sau khi đối chiếu</div>
        </div>
      </Link>
    )),
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user?.fullName || user?.username}`}
        description={`Tổng quan chung cư BlueMoon · ${ROLE_LABELS[user?.role ?? 'User']}`}
        action={<BuildingFilter value={building} onChange={setBuilding} id="dash-building" />}
      />

      {tasks.length > 0 && (
        <div className="grid grid-2 mb-20" style={{ gap: 12 }}>
          {tasks}
        </div>
      )}

      <div className="grid grid-4 mb-20">
        <Link to={`/apartments${building ? `?building=${building}` : ''}`} className="card stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-label">Căn hộ {building && `· Tòa ${building}`}</div>
          <div className="stat-value">{counts.data?.apts.toLocaleString('vi-VN') ?? '…'}</div>
          <div className="stat-sub">{counts.data ? `${counts.data.occupied} đang có người ở` : ''}</div>
        </Link>
        <Link to="/households" className="card stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-label">Hộ gia đình đang ở</div>
          <div className="stat-value">{counts.data?.households.toLocaleString('vi-VN') ?? '…'}</div>
          <div className="stat-sub">
            {counts.data && counts.data.apts ? `Lấp đầy ${formatPercent((counts.data.occupied / counts.data.apts) * 100)}` : ''}
          </div>
        </Link>
        <Link to="/residents" className="card stat-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-label">Nhân khẩu</div>
          <div className="stat-value">{counts.data?.residents.toLocaleString('vi-VN') ?? '…'}</div>
          <div className="stat-sub">{counts.data ? `${counts.data.temp} tạm trú · ${counts.data.absent} tạm vắng` : ''}</div>
        </Link>
        <Link to="/fee-charges?view=overdue" className="card stat-card tone-danger" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stat-label">Quá hạn</div>
          <div className="stat-value text-danger">{f ? formatMoney(f.overdueAmount) : '…'}</div>
          <div className="stat-sub">{f ? `${f.overdueApartmentCount} căn · ${f.overdueChargeCount} khoản` : ''}</div>
        </Link>
      </div>

      <div className="grid grid-4 mb-20">
        <div className="card stat-card">
          <div className="stat-label">Tổng phải thu</div>
          <div className="stat-value">{f ? formatMoney(f.totalAmount) : '…'}</div>
          <div className="stat-sub">{f ? `${f.chargeCount.toLocaleString('vi-VN')} khoản` : ''}</div>
        </div>
        <div className="card stat-card tone-success">
          <div className="stat-label">Đã thu</div>
          <div className="stat-value">{f ? formatMoney(f.paidAmount) : '…'}</div>
          <div className="stat-sub">{f ? `${f.paymentCount.toLocaleString('vi-VN')} phiếu thu` : ''}</div>
        </div>
        <div className="card stat-card tone-warning">
          <div className="stat-label">Còn nợ</div>
          <div className="stat-value">{f ? formatMoney(f.outstandingAmount) : '…'}</div>
          <div className="stat-sub">{f ? `${f.dueSoonChargeCount} khoản sắp đến hạn` : ''}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Tỷ lệ thu</div>
          <div className="stat-value">{f ? formatPercent(f.collectionRate) : '…'}</div>
          <div className="stat-sub">{f ? `${f.paidChargeCount} đủ · ${f.partiallyPaidChargeCount} một phần · ${f.unpaidChargeCount} chưa` : ''}</div>
        </div>
      </div>

      <div className="grid grid-2 mb-20">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title mb-0">Doanh thu theo ngày thu thực tế</h3>
            <div className="btn-group">
              {(
                [
                  ['month', 'Tháng'],
                  ['quarter', 'Quý'],
                  ['year', 'Năm'],
                ] as [Period, string][]
              ).map(([p, t]) => (
                <button key={p} type="button" className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPeriod(p)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <DataState loading={revenue.loading} error={revenue.error} empty={!revenue.data?.buckets.length} emptyText="Chưa có doanh thu.">
            <div className="bar-chart" role="img" aria-label="Biểu đồ doanh thu">
              {revenue.data?.buckets.map((b) => (
                <div key={b.period} className="bar-col" title={`${b.label}: ${formatMoney(b.amount)} · ${b.paymentCount} phiếu`}>
                  <span className="bar-value">{b.amount ? compactMoney(b.amount) : ''}</span>
                  <div className="bar" style={{ height: `${(b.amount / maxRevenue) * 140}px` }} />
                  <span className="bar-label">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="text-muted small mb-0">
              Tổng giai đoạn: <strong>{formatMoney(revenue.data?.totalAmount ?? 0)}</strong> · {revenue.data?.paymentCount ?? 0} phiếu thu
            </p>
          </DataState>
        </div>

        <div className="card">
          <h3 className="section-title">Tuổi nợ (công nợ còn lại)</h3>
          <DataState loading={aging.loading} error={aging.error} empty={!aging.data} emptyText="">
            <table>
              <tbody>
                {aging.data?.buckets.map((b) => (
                  <tr key={b.key}>
                    <td className={b.key === 'current' ? '' : b.key === '60+' ? 'text-danger fw-bold' : 'text-warning fw-bold'}>{b.label}</td>
                    <td className="text-right">{b.apartmentCount} căn</td>
                    <td className="text-right">{b.chargeCount} khoản</td>
                    <td className="text-right fw-bold">{formatMoney(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Tổng còn nợ</td>
                  <td className="text-right">{formatMoney(aging.data?.totalOutstanding ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </DataState>
        </div>
      </div>

      <div className="card card-flush mb-20">
        <div className="card-head">
          <h3 className="section-title mb-0">Căn hộ quá hạn nhiều nhất</h3>
          <Link to="/fee-charges?view=overdue" className="btn btn-ghost btn-sm">
            Xem tất cả →
          </Link>
        </div>
        <DataState loading={aging.loading} error={aging.error} empty={!aging.data?.apartments.length} emptyText="Không có căn hộ nào quá hạn. 🎉">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Căn hộ</th>
                  <th>Chủ hộ</th>
                  <th>SĐT</th>
                  <th className="text-right">Số khoản</th>
                  <th className="text-right">Quá hạn</th>
                  <th className="text-right">Trễ tối đa</th>
                  <th>Nhắc gần nhất</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {aging.data?.apartments.map((x) => (
                  <tr key={x.apartmentId}>
                    <td className="fw-bold">
                      <Link to={`/fee-charges?q=${encodeURIComponent(x.apartmentCode)}&view=overdue`}>{x.apartmentCode}</Link>
                    </td>
                    <td>{x.headOfHousehold ?? '—'}</td>
                    <td>{x.phoneNumber ?? '—'}</td>
                    <td className="text-right">{x.chargeCount}</td>
                    <td className="text-right text-danger fw-bold">{formatMoney(x.overdueAmount)}</td>
                    <td className="text-right">{x.maxDaysOverdue} ngày</td>
                    <td>{x.lastReminderAt ? formatRelative(x.lastReminderAt) : <span className="text-muted">Chưa nhắc</span>}</td>
                    <td className="text-right">
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remindApartment(x.apartmentId, x.apartmentCode)}>
                        Nhắc nợ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>

      <div className="card card-flush">
        <div className="card-head">
          <h3 className="section-title mb-0">Thống kê theo đợt thu</h3>
          <Link to="/fee-collections" className="btn btn-ghost btn-sm">
            Quản lý đợt thu →
          </Link>
        </div>
        <DataState loading={collections.loading} error={collections.error} empty={!collections.data?.length} emptyText="Chưa có đợt thu nào." onRetry={collections.reload}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Đợt thu</th>
                  <th>Hạn nộp</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Phải thu</th>
                  <th className="text-right">Đã thu</th>
                  <th className="text-right">Còn nợ</th>
                  <th className="text-right">Quá hạn</th>
                  <th>Tỷ lệ thu</th>
                </tr>
              </thead>
              <tbody>
                {collections.data?.slice(0, 8).map((c) => (
                  <tr key={c.feeCollectionId}>
                    <td className="fw-bold">
                      <Link to={`/fee-charges?feeCollectionId=${c.feeCollectionId}`}>{c.feeCollectionName}</Link>
                    </td>
                    <td>{formatDate(c.dueDate)}</td>
                    <td>
                      <StatusBadge value={c.status} label={label(COLLECTION_STATUS_LABELS, c.status)} />
                    </td>
                    <td className="text-right">{formatMoney(c.totalAmount)}</td>
                    <td className="text-right text-success">{formatMoney(c.paidAmount)}</td>
                    <td className="text-right">{formatMoney(c.outstandingAmount)}</td>
                    <td className={`text-right ${(c.overdueAmount ?? 0) > 0 ? 'text-danger fw-bold' : 'text-muted'}`}>{formatMoney(c.overdueAmount ?? 0)}</td>
                    <td>
                      <div className="rate-cell">
                        <div className="progress">
                          <span style={{ width: `${Math.min(100, c.collectionRate)}%` }} />
                        </div>
                        {formatPercent(c.collectionRate)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>
    </>
  )
}
