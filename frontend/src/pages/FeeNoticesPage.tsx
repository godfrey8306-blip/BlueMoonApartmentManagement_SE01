/**
 * FeeNoticesPage.tsx — /fee-collections/:id/notices (PBI-012 Thông báo thu phí)
 * Xem & in giấy báo phí / giấy nhắc nợ của một đợt thu — mỗi căn hộ một trang.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataState } from '../components/DataState'
import { BuildingFilter, SearchInput, SelectFilter } from '../components/Filters'
import { useAsync } from '../hooks/useAsync'
import { feeCollectionsApi } from '../lib/services'
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../lib/format'
import type { FeeNotice } from '../types/models'

export function NoticeSheet({ notice }: { notice: FeeNotice }) {
  const reminder = notice.type === 'Reminder'
  return (
    <div className="notice-sheet">
      <div className="text-muted small" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>BAN QUẢN TRỊ CHUNG CƯ BLUEMOON</span>
        <span>Số: {notice.type === 'Reminder' ? 'NN' : 'GB'}-{notice.year}{String(notice.month).padStart(2, '0')}-{notice.apartmentCode}</span>
      </div>
      <h3>{reminder ? 'GIẤY NHẮC NỢ PHÍ QUÁ HẠN' : 'GIẤY BÁO THU PHÍ'}</h3>
      <div className="text-center text-muted">
        Kỳ thu tháng {String(notice.month).padStart(2, '0')}/{notice.year}
      </div>
      <dl className="detail-list mt-16">
        <dt>Kính gửi</dt>
        <dd>
          {notice.headOfHousehold ? `Ông/Bà ${notice.headOfHousehold}` : 'Quý cư dân'} — hộ {notice.householdCode ?? '—'}
        </dd>
        <dt>Căn hộ</dt>
        <dd>
          {notice.apartmentCode} · Tòa {notice.building}
        </dd>
        <dt>Hạn nộp</dt>
        <dd className={notice.isOverdue ? 'text-danger' : ''}>
          {formatDate(notice.dueDate)} {notice.isOverdue && '(đã quá hạn)'}
        </dd>
      </dl>
      <table>
        <thead>
          <tr>
            <th>Khoản thu</th>
            <th className="text-right">Số lượng</th>
            <th className="text-right">Đơn giá</th>
            <th className="text-right">Thành tiền</th>
            <th className="text-right">Đã nộp</th>
          </tr>
        </thead>
        <tbody>
          {notice.lines.map((l) => (
            <tr key={l.feeCategoryName}>
              <td>{l.feeCategoryName}</td>
              <td className="text-right">
                {formatNumber(l.quantity)} {l.unit}
              </td>
              <td className="text-right">{formatMoney(l.unitPrice)}</td>
              <td className="text-right">{formatMoney(l.amount)}</td>
              <td className="text-right">{formatMoney(l.paidAmount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Tổng phải nộp</td>
            <td className="text-right">{formatMoney(notice.lines.reduce((s, l) => s + l.amount, 0))}</td>
            <td className="text-right">{formatMoney(notice.lines.reduce((s, l) => s + l.paidAmount, 0))}</td>
          </tr>
          <tr>
            <td colSpan={3}>Còn phải nộp</td>
            <td colSpan={2} className="text-right text-danger">
              {formatMoney(notice.lines.reduce((s, l) => s + l.amount - l.paidAmount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>
      {notice.message && <p style={{ marginTop: 12 }}>Ghi chú: {notice.message}</p>}
      <p className="text-muted small" style={{ marginTop: 12 }}>
        Quý cư dân vui lòng nộp tại văn phòng Ban quản trị hoặc chuyển khoản, ghi rõ mã căn hộ. Phát hành lúc {formatDateTime(notice.issuedAt)}.
      </p>
      <div className="sign">
        <div>
          <div className="fw-bold">Người lập</div>
          <div className="text-muted small" style={{ marginTop: 40 }}>
            {notice.issuedByUsername}
          </div>
        </div>
        <div>
          <div className="fw-bold">Ban quản trị</div>
          <div className="text-muted small" style={{ marginTop: 40 }}>
            (ký, ghi rõ họ tên)
          </div>
        </div>
      </div>
    </div>
  )
}

export function FeeNoticesPage() {
  const { id } = useParams()
  const collectionId = Number(id)
  const [type, setType] = useState('Notice')
  const [building, setBuilding] = useState('')
  const [q, setQ] = useState('')

  const collection = useAsync(() => feeCollectionsApi.get(collectionId), [collectionId])
  const notices = useAsync(
    () => feeCollectionsApi.notices(collectionId, { type, building: building || undefined, q: q || undefined }),
    [collectionId, type, building, q],
  )

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={`Giấy báo phí — ${collection.data?.name ?? ''}`}
          description={`Hạn nộp ${formatDate(collection.data?.dueDate)} · ${notices.data?.length ?? 0} giấy đang hiển thị.`}
          action={
            <div className="btn-group">
              <Link to="/fee-collections" className="btn btn-secondary">
                ← Đợt thu
              </Link>
              <button type="button" className="btn btn-primary" onClick={() => window.print()} disabled={!notices.data?.length}>
                🖨 In tất cả ({notices.data?.length ?? 0})
              </button>
            </div>
          }
        />
        <div className="card mb-20">
          <div className="toolbar mb-0">
            <SelectFilter
              id="nt-type"
              label="Loại"
              value={type}
              onChange={setType}
              allLabel="Tất cả"
              options={[
                { value: 'Notice', label: 'Giấy báo phí' },
                { value: 'Reminder', label: 'Nhắc nợ quá hạn' },
              ]}
            />
            <BuildingFilter value={building} onChange={setBuilding} />
            <SearchInput id="nt-q" label="Mã căn hộ" value={q} onChange={setQ} />
          </div>
        </div>
      </div>
      <DataState loading={notices.loading} error={notices.error} empty={!notices.data?.length} emptyText="Chưa phát hành giấy báo nào cho đợt này." onRetry={notices.reload}>
        <div className="printable">
          {notices.data?.map((n) => <NoticeSheet key={n.id} notice={n} />)}
        </div>
      </DataState>
    </>
  )
}
