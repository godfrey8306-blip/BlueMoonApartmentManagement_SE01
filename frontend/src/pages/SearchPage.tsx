/**
 * SearchPage.tsx — /search (PBI-005, PBI-016, PBI-017 / US-005, US-010)
 *  Tab "Cư dân & hộ"   : tìm theo mã căn, mã hộ, họ tên (không dấu), CCCD, SĐT — gom theo hộ
 *  Tab "Khoản thu"     : tra cứu khoản phải thu theo kỳ / căn / trạng thái / quá hạn
 *  Tab "Hóa đơn"       : tra cứu từng dòng thanh toán theo thời gian / phiếu thu
 * Tất cả phân trang phía server.
 */
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, Pagination, type Column } from '../components/DataTable'
import { DataState } from '../components/DataState'
import { BuildingFilter, FilterBar, SearchInput, SelectFilter } from '../components/Filters'
import { StatusBadge } from '../components/StatusBadge'
import { ChargeStatus } from '../components/FeeBadges'
import { useListQuery } from '../hooks/useListQuery'
import { useAsync } from '../hooks/useAsync'
import { feeCollectionsApi, searchApi } from '../lib/services'
import { CHARGE_STATUS_LABELS, RESIDENT_STATUS_LABELS, formatDate, formatDateTime, formatMoney, label } from '../lib/format'
import type { FinancialSearchResult, PaymentSearchResult } from '../types/models'

type Tab = 'residents' | 'charges' | 'payments'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'residents'

  return (
    <>
      <PageHeader title="Tra cứu" description="Tìm nhanh cư dân, khoản phải thu và hóa đơn thanh toán trên toàn bộ các tòa." />
      <div className="tabs" role="tablist">
        {(
          [
            ['residents', '👥 Cư dân & Hộ gia đình'],
            ['charges', '💰 Khoản phải thu'],
            ['payments', '🧾 Hóa đơn / Thanh toán'],
          ] as [Tab, string][]
        ).map(([key, text]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setParams({ tab: key }, { replace: true })}>
            {text}
          </button>
        ))}
      </div>
      {tab === 'residents' && <ResidentSearch />}
      {tab === 'charges' && <ChargeSearch />}
      {tab === 'payments' && <PaymentSearch />}
    </>
  )
}

function ResidentSearch() {
  const list = useListQuery(['search', 'building', 'isActive'] as const, (p) => searchApi.households(p), { pageSize: 10 })
  const { filters, setFilter } = list
  const term = filters.search.trim().toLowerCase()

  return (
    <div className="card">
      <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
        <SearchInput
          id="s-text"
          label="Từ khóa"
          value={filters.search}
          onChange={(v) => setFilter('search', v)}
          placeholder="Mã căn hộ, mã hộ, họ tên (không dấu), CCCD hoặc số điện thoại…"
          autoFocus
        />
        <BuildingFilter value={filters.building} onChange={(v) => setFilter('building', v)} />
        <SelectFilter
          id="s-active"
          label="Trạng thái hộ"
          value={filters.isActive}
          onChange={(v) => setFilter('isActive', v)}
          options={[
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Ngừng hoạt động' },
          ]}
        />
      </FilterBar>

      <DataState loading={list.loading && !list.data} error={list.error} empty={!list.data?.items.length} emptyText="Không tìm thấy hộ gia đình / cư dân phù hợp." onRetry={list.reload}>
        <div className={list.loading ? 'is-loading' : ''}>
          {list.data?.items.map((h) => (
            <div key={h.id} className="result-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                <div>
                  <span className="fw-bold" style={{ fontSize: '1.05rem' }}>
                    Hộ {h.householdCode}
                  </span>{' '}
                  <span className="text-muted">
                    · Căn {h.apartmentCode} · Tòa {h.building} · {h.residentCount} nhân khẩu
                  </span>{' '}
                  <StatusBadge value={h.isActive ? 'Active' : 'Inactive'} label={h.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'} />
                </div>
                <div className="btn-group">
                  <Link className="btn btn-ghost btn-sm" to={`/residents?householdId=${h.id}`}>
                    Nhân khẩu
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to={`/fee-charges?q=${encodeURIComponent(h.apartmentCode)}`}>
                    Công nợ
                  </Link>
                  <Link className="btn btn-ghost btn-sm" to={`/payments?q=${encodeURIComponent(h.apartmentCode)}`}>
                    Lịch sử đóng tiền
                  </Link>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Họ tên</th>
                      <th>CCCD</th>
                      <th>SĐT</th>
                      <th>Quan hệ</th>
                      <th>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h.residents.map((r) => {
                      const hit = term && (r.identityNumber.includes(term) || r.phoneNumber.includes(term))
                      return (
                        <tr key={r.id} style={hit ? { background: '#fefce8' } : undefined}>
                          <td className="fw-bold">
                            {r.fullName}
                            {r.isHouseholdHead && (
                              <span className="badge badge-info" style={{ marginLeft: 8 }}>
                                Chủ hộ
                              </span>
                            )}
                          </td>
                          <td>{r.identityNumber}</td>
                          <td>{r.phoneNumber || '—'}</td>
                          <td>{r.relationship || '—'}</td>
                          <td>
                            <StatusBadge value={r.status} label={label(RESIDENT_STATUS_LABELS, r.status)} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DataState>
      {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} sizes={[10, 20, 50]} />}
    </div>
  )
}

function ChargeSearch() {
  const collections = useAsync(() => feeCollectionsApi.list(), [])
  const list = useListQuery(['q', 'feeCollectionId', 'status', 'overdue', 'year'] as const, (p) => searchApi.charges(p))
  const { filters, setFilter } = list

  const columns: Column<FinancialSearchResult>[] = [
    { key: 'apt', header: 'Căn hộ', render: (c) => <span className="fw-bold">{c.apartmentCode}</span> },
    { key: 'col', header: 'Kỳ', render: (c) => `${String(c.feeCollectionMonth).padStart(2, '0')}/${c.feeCollectionYear}` },
    { key: 'cat', header: 'Khoản thu', render: (c) => c.feeCategoryName },
    { key: 'total', header: 'Tổng tiền', align: 'right', render: (c) => formatMoney(c.totalAmount) },
    { key: 'paid', header: 'Đã thu', align: 'right', render: (c) => <span className="text-success">{formatMoney(c.paidAmount)}</span> },
    { key: 'out', header: 'Còn nợ', align: 'right', render: (c) => <span className={c.outstandingAmount > 0 ? 'text-danger fw-bold' : ''}>{formatMoney(c.outstandingAmount)}</span> },
    { key: 'due', header: 'Hạn nộp', render: (c) => formatDate(c.dueDate) },
    { key: 'st', header: 'Trạng thái', render: (c) => <ChargeStatus charge={c} /> },
  ]

  return (
    <div className="card">
      <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
        <SearchInput id="c-q" label="Mã căn hộ" value={filters.q} onChange={(v) => setFilter('q', v)} />
        <SelectFilter
          id="c-col"
          label="Đợt thu"
          value={filters.feeCollectionId}
          onChange={(v) => setFilter('feeCollectionId', v)}
          options={(collections.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <SelectFilter
          id="c-status"
          label="Trạng thái"
          value={filters.status}
          onChange={(v) => setFilter('status', v)}
          options={Object.entries(CHARGE_STATUS_LABELS).map(([value, l]) => ({ value, label: l }))}
        />
        <SelectFilter id="c-overdue" label="Hạn nộp" value={filters.overdue} onChange={(v) => setFilter('overdue', v)} options={[{ value: 'true', label: 'Chỉ khoản quá hạn' }]} />
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(c) => c.feeChargeId} loading={list.loading} error={list.error} onRetry={list.reload} rowClassName={(c) => (c.isOverdue ? 'row-overdue' : undefined)} />
      {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
    </div>
  )
}

function PaymentSearch() {
  const collections = useAsync(() => feeCollectionsApi.list(), [])
  const list = useListQuery(['receiptNumber', 'feeCollectionId', 'fromDate', 'toDate'] as const, (p) => searchApi.payments(p))
  const { filters, setFilter } = list

  const columns: Column<PaymentSearchResult>[] = [
    { key: 'r', header: 'Mã phiếu', render: (p) => <span className="fw-bold">{p.receiptNumber}</span> },
    { key: 'd', header: 'Ngày đóng', render: (p) => formatDateTime(p.paymentDate) },
    { key: 'a', header: 'Căn hộ', render: (p) => p.apartmentCode },
    { key: 'c', header: 'Khoản thu', render: (p) => p.feeCategoryName },
    { key: 'col', header: 'Đợt thu', render: (p) => p.feeCollectionName },
    { key: 'm', header: 'Phương thức', render: (p) => p.paymentMethod },
    { key: 'amt', header: 'Số tiền', align: 'right', render: (p) => formatMoney(p.amount) },
  ]

  return (
    <div className="card">
      <FilterBar activeCount={list.activeFilterCount} onClear={list.clearFilters}>
        <SearchInput id="p-receipt" label="Mã phiếu thu" value={filters.receiptNumber} onChange={(v) => setFilter('receiptNumber', v)} />
        <SelectFilter
          id="p-col"
          label="Đợt thu"
          value={filters.feeCollectionId}
          onChange={(v) => setFilter('feeCollectionId', v)}
          options={(collections.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
        />
        <div className="field">
          <label htmlFor="p-from">Từ ngày</label>
          <input id="p-from" type="date" value={filters.fromDate} onChange={(e) => setFilter('fromDate', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-to">Đến ngày</label>
          <input id="p-to" type="date" value={filters.toDate} onChange={(e) => setFilter('toDate', e.target.value)} />
        </div>
      </FilterBar>
      <DataTable columns={columns} rows={list.data?.items} rowKey={(p) => `${p.paymentId}-${p.feeChargeId}`} loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data && <Pagination page={list.page} pageSize={list.pageSize} total={list.data.total} onPage={list.setPage} onPageSize={list.setPageSize} />}
    </div>
  )
}
