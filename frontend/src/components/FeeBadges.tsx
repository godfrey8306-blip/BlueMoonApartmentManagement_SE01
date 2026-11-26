import { StatusBadge } from './StatusBadge'
import { CHARGE_STATUS_LABELS, formatDate, label } from '../lib/format'

interface ChargeLike {
  status: string
  dueDate: string | null
  outstandingAmount: number
  isOverdue?: boolean
  daysOverdue?: number
  isDueSoon?: boolean
}

/** Trạng thái thanh toán + nhãn quá hạn / sắp đến hạn. */
export function ChargeStatus({ charge }: { charge: ChargeLike }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      <StatusBadge value={charge.status} label={label(CHARGE_STATUS_LABELS, charge.status)} />
      {charge.isOverdue && <StatusBadge value="overdue" tone="danger" label={`Quá hạn ${charge.daysOverdue} ngày`} />}
      {!charge.isOverdue && charge.isDueSoon && <StatusBadge value="soon" tone="warning" label="Sắp đến hạn" />}
    </span>
  )
}

/** Ngày hạn nộp, tô đỏ khi quá hạn. */
export function DueDate({ charge }: { charge: ChargeLike }) {
  return (
    <span className={charge.isOverdue ? 'text-danger fw-bold' : charge.isDueSoon ? 'text-warning fw-bold' : ''}>
      {formatDate(charge.dueDate)}
    </span>
  )
}
