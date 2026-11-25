export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const tone = normalized === 'paid' || normalized === 'active' ? 'badge-success' : normalized.includes('partial') || normalized === 'open' ? 'badge-warning' : 'badge-muted'
  return <span className={`badge ${tone}`}>{value}</span>
}
