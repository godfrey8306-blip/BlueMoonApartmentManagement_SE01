/**
 * format.ts — Định dạng tiền tệ, ngày tháng, nhãn hiển thị tiếng Việt.
 */

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

export function formatMoney(value: number | null | undefined): string {
  return value == null ? '—' : vnd.format(value)
}

export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : num.format(value)
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${num.format(value)}%`
}

/** Lấy phần YYYY-MM-DD của chuỗi ISO (không đổi múi giờ, tránh lệch ngày). */
export function isoDatePart(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

export function formatDate(value: string | null | undefined): string {
  const d = isoDatePart(value)
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * Chuyển giá trị <input type="date"> (YYYY-MM-DD) thành ISO UTC nửa đêm.
 * Backend dùng PostgreSQL timestamptz → Npgsql yêu cầu DateTime Kind=Utc.
 */
export function dateInputToIso(value: string): string | null {
  return value ? `${value}T00:00:00Z` : null
}

function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayInput(): string {
  return localKey(new Date())
}

/** Ngày (YYYY-MM-DD) theo giờ địa phương của một mốc thời gian có giờ (VD: PaymentDate). */
export function localDateOf(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localKey(d)
}

// ── Nhãn hiển thị ────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  Admin: 'Ban quản trị',
  User: 'Kế toán',
  Resident: 'Cư dân',
}

export const APARTMENT_STATUS_LABELS: Record<string, string> = {
  Available: 'Còn trống',
  Occupied: 'Đang ở',
  Maintenance: 'Đang sửa chữa',
}

/**
 * Trạng thái cư trú của nhân khẩu (Resident.Status là chuỗi tự do max 30 ký tự).
 * Backend chưa có loại biến động Tạm trú / Tạm vắng → thể hiện qua Status.
 */
export const RESIDENT_STATUS_LABELS: Record<string, string> = {
  Active: 'Thường trú',
  TemporaryResident: 'Tạm trú',
  TemporarilyAbsent: 'Tạm vắng',
  MovedOut: 'Đã chuyển đi',
  Deceased: 'Đã mất',
}

export const HISTORY_TYPE_LABELS: Record<string, string> = {
  MoveIn: 'Chuyển đến',
  MoveOut: 'Chuyển đi',
  TemporaryResidence: 'Tạm trú',
  TemporaryAbsence: 'Tạm vắng',
  InformationChange: 'Thay đổi thông tin',
}

export const COLLECTION_STATUS_LABELS: Record<string, string> = {
  Open: 'Đang mở',
  Closed: 'Đã đóng',
  Cancelled: 'Đã hủy',
}

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  Unpaid: 'Chưa thanh toán',
  PartiallyPaid: 'Thanh toán một phần',
  Paid: 'Đã thanh toán',
}

export const GENDER_OPTIONS = ['Nam', 'Nữ', 'Khác']

export const RELATIONSHIP_OPTIONS = ['Chủ hộ', 'Vợ', 'Chồng', 'Con', 'Bố', 'Mẹ', 'Anh', 'Chị', 'Em', 'Ông', 'Bà', 'Cháu', 'Người thuê trọ', 'Khác']

export const PAYMENT_METHODS = ['Tiền mặt', 'Chuyển khoản', 'Quẹt thẻ', 'Ví điện tử']

export const CALCULATION_METHODS: Record<string, string> = {
  Fixed: 'Cố định / căn hộ',
  PerArea: 'Theo diện tích (m²)',
  PerResident: 'Theo nhân khẩu',
  Voluntary: 'Tự nguyện',
}

export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return map[value] ?? value
}

/** Xuất mảng dữ liệu ra file CSV (UTF-8 BOM để Excel đọc đúng tiếng Việt). */
export function exportCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const escape = (v: string | number | boolean | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** "5 phút trước", "hôm qua", hoặc ngày cụ thể. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  const diff = (Date.now() - d.getTime()) / 1000
  if (Number.isNaN(diff)) return value
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 172800) return 'hôm qua'
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`
  return d.toLocaleDateString('vi-VN')
}

/** Tuổi tính từ ngày sinh (YYYY-MM-DD…). */
export function ageOf(dob: string | null | undefined): number | null {
  const d = isoDatePart(dob)
  if (!d) return null
  const [y, m, day] = d.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < day)) age--
  return age
}

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Tháng ${i + 1}` }))
