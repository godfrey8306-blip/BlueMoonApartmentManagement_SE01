type Tone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

const TONES: Record<string, Tone> = {
  paid: 'success',
  active: 'success',
  available: 'success',
  open: 'warning',
  partiallypaid: 'warning',
  temporaryresident: 'info',
  temporarilyabsent: 'warning',
  occupied: 'info',
  maintenance: 'warning',
  unpaid: 'danger',
  cancelled: 'danger',
  locked: 'danger',
  movedout: 'muted',
  closed: 'muted',
  inactive: 'muted',
  movein: 'success',
  moveout: 'danger',
  informationchange: 'info',
}

/**
 * Badge trạng thái. `value` là giá trị gốc từ backend (dùng để chọn màu),
 * `label` là nhãn hiển thị tiếng Việt (mặc định = value).
 */
export function StatusBadge({ value, label, tone }: { value: string; label?: string; tone?: Tone }) {
  const key = value.toLowerCase().replace(/[\s_-]/g, '')
  const resolved: Tone = tone ?? TONES[key] ?? (key.includes('partial') ? 'warning' : 'muted')
  return <span className={`badge badge-${resolved}`}>{label ?? value}</span>
}
