// ============================================================
// Domain types — ánh xạ 1:1 với DTO trong src/BlueMoon.API/DTOs
// (System.Text.Json serialize camelCase; DateTime → chuỗi ISO)
// ============================================================

// ── Apartments ───────────────────────────────────────────────
export interface Apartment {
  id: number
  apartmentCode: string
  building: string
  floor: number
  area: number
  status: string
  householdCode?: string | null
  residentCount?: number
}
export interface ApartmentInput {
  apartmentCode: string
  building: string
  floor: number
  area: number
  status: string
}

// ── Households ───────────────────────────────────────────────
export interface Household {
  id: number
  householdCode: string
  apartmentId: number
  apartmentCode: string
  building: string
  createdAt: string
  isActive: boolean
  headResidentId?: number | null
  headOfHousehold?: string | null
  headPhoneNumber?: string | null
  residentCount?: number
  accountUserId?: number | null
  accountUsername?: string | null
}
export interface HouseholdCreateInput {
  householdCode: string
  apartmentId: number
}
export interface HouseholdUpdateInput extends HouseholdCreateInput {
  isActive: boolean
}
export interface HouseholdFilter {
  apartmentId?: number
  isActive?: boolean
  householdCode?: string
}

// ── Residents ────────────────────────────────────────────────
export interface Resident {
  id: number
  householdId: number
  householdCode: string
  apartmentId: number
  apartmentCode: string
  building: string
  fullName: string
  identityNumber: string
  dateOfBirth: string | null
  gender: string
  phoneNumber: string
  relationship: string
  isHouseholdHead: boolean
  status: string
}
export interface ResidentInput {
  householdId: number
  fullName: string
  identityNumber: string
  dateOfBirth: string | null
  gender: string
  phoneNumber: string
  relationship: string
  isHouseholdHead: boolean
  status: string
}
export interface ResidentFilter {
  householdId?: number
  apartmentId?: number
  name?: string
  status?: string
}

// ── Residence histories ──────────────────────────────────────
export type HistoryType = 'MoveIn' | 'MoveOut' | 'TemporaryResidence' | 'TemporaryAbsence' | 'InformationChange'
export interface ResidentHistory {
  id: number
  residentId: number
  residentFullName: string
  householdId: number
  householdCode: string
  apartmentId: number
  apartmentCode: string
  historyType: HistoryType
  startDate: string
  endDate: string | null
  destination: string | null
  note: string
  previousValue: string | null
  newValue: string | null
  createdByUserId: number
}
export interface ResidentHistoryInput {
  residentId: number
  historyType: HistoryType
  startDate: string
  endDate: string | null
  destination: string | null
  note: string
  previousValue: string | null
  newValue: string | null
}
export interface ResidentHistoryFilter {
  residentId?: number
  historyType?: string
  fromDate?: string
  toDate?: string
}

// ── Fee categories ───────────────────────────────────────────
export interface FeeCategory {
  id: number
  name: string
  description: string | null
  unit: string
  unitPrice: number
  calculationMethod: string
  isMandatory: boolean
  isActive: boolean
}
export interface FeeCategoryCreateInput {
  name: string
  description: string | null
  unit: string
  unitPrice: number
  calculationMethod: string
  isMandatory: boolean
}
export interface FeeCategoryUpdateInput extends FeeCategoryCreateInput {
  isActive: boolean
}

// ── Fee collections ──────────────────────────────────────────
export type FeeCollectionStatus = 'Open' | 'Closed' | 'Cancelled'
export interface FeeCollection {
  id: number
  name: string
  month: number
  year: number
  createdAt: string
  createdByUserId: number
  createdByUsername: string
  status: FeeCollectionStatus
  dueDate: string
  chargeCount: number
  noticeCount: number
}
export interface FeeCollectionCreateInput {
  name: string
  month: number
  year: number
  dueDate?: string | null
}
export interface FeeCollectionUpdateInput extends FeeCollectionCreateInput {
  status: FeeCollectionStatus
}
export interface FeeCollectionFilter {
  month?: number
  year?: number
  status?: string
}

// ── Fee charges ──────────────────────────────────────────────
export type FeeChargeStatus = 'Unpaid' | 'PartiallyPaid' | 'Paid'
export interface FeeCharge {
  id: number
  feeCollectionId: number
  feeCollectionName: string
  feeCollectionMonth: number
  feeCollectionYear: number
  feeCollectionStatus: string
  apartmentId: number
  apartmentCode: string
  apartmentBuilding: string
  feeCategoryId: number
  feeCategoryName: string
  feeCategoryUnit: string
  calculationMethod: string
  quantity: number
  unitPrice: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  dueDate: string | null
  status: FeeChargeStatus
  isOverdue: boolean
  daysOverdue: number
  isDueSoon: boolean
}
export interface FeeChargeCreateInput {
  feeCollectionId: number
  apartmentId: number
  feeCategoryId: number
  quantity: number
  dueDate: string | null
}
export interface FeeChargeUpdateInput {
  quantity: number
  dueDate: string | null
}
export interface FeeChargeFilter {
  feeCollectionId?: number
  apartmentId?: number
  feeCategoryId?: number
  status?: string
}
export interface FeeChargeDebtSummary {
  apartmentId: number
  apartmentCode: string
  feeCollectionId: number | null
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  chargeCount: number
  charges: FeeCharge[]
}

// ── Payments ─────────────────────────────────────────────────
export interface PaymentDetail {
  id: number
  feeChargeId: number
  feeCategoryName: string
  feeCollectionId: number
  feeCollectionName: string
  amount: number
  dueDate?: string | null
  isLate?: boolean
}
export interface Payment {
  id: number
  apartmentId: number
  apartmentCode: string
  residentId: number | null
  residentFullName: string
  receivedByUserId: number
  receivedByUsername?: string
  receiptNumber: string
  paymentDate: string
  totalAmount: number
  paymentMethod: string
  note: string
  details: PaymentDetail[]
}
export interface PaymentCreateInput {
  apartmentId: number
  residentId: number | null
  receiptNumber: string
  paymentDate: string | null
  paymentMethod: string
  note: string | null
  details: { feeChargeId: number; amount: number }[]
}
export interface PaymentFilter {
  apartmentId?: number
  feeChargeId?: number
  receiptNumber?: string
}
export interface PaymentDetailHistory {
  paymentId: number
  receiptNumber: string
  paymentDate: string
  paymentMethod: string
  amount: number
}

// ── Search & statistics ──────────────────────────────────────
export interface ResidentSearchResult {
  id: number
  fullName: string
  identityNumber: string
  phoneNumber: string
  relationship: string
  isHouseholdHead: boolean
  status: string
}
export interface HouseholdSearchResult {
  id: number
  householdCode: string
  apartmentId: number
  apartmentCode: string
  building: string
  isActive: boolean
  residentCount: number
  residents: ResidentSearchResult[]
}
export interface FinancialSearchResult {
  feeChargeId: number
  apartmentId: number
  apartmentCode: string
  feeCollectionId: number
  feeCollectionName: string
  feeCollectionMonth: number
  feeCollectionYear: number
  feeCategoryId: number
  feeCategoryName: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  status: string
  dueDate: string | null
  isOverdue?: boolean
  daysOverdue?: number
}
export interface PaymentSearchResult {
  paymentId: number
  apartmentId: number
  apartmentCode: string
  receiptNumber: string
  paymentDate: string
  amount: number
  paymentMethod: string
  feeChargeId: number
  feeCategoryName: string
  feeCollectionId: number
  feeCollectionName: string
}
export interface CollectionStatistics {
  feeCollectionId: number
  feeCollectionName: string
  month: number
  year: number
  status: string
  chargeCount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  collectionRate: number
  dueDate?: string
  overdueAmount?: number
}
export interface FinancialStatistics {
  chargeCount: number
  paymentCount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  collectionRate: number
  unpaidChargeCount: number
  partiallyPaidChargeCount: number
  paidChargeCount: number
  overdueChargeCount: number
  overdueAmount: number
  overdueApartmentCount: number
  dueSoonChargeCount: number
}
export interface ApartmentStatistics {
  apartmentId: number
  apartmentCode: string
  chargeCount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  collectionRate: number
}

// ── Phân trang ───────────────────────────────────────────────
export interface Paged<T> {
  items: T[]
  total: number
  /** Tổng tiền của toàn bộ tập lọc (header X-Total-Amount, X-Paid-Amount, X-Outstanding-Amount) */
  totalAmount?: number
  paidAmount?: number
  outstandingAmount?: number
}

// ── Lookup & tìm kiếm toàn cục ───────────────────────────────
export type LookupKind = 'apartments' | 'households' | 'residents'
export interface LookupItem {
  id: number
  label: string
  description?: string | null
  apartmentId?: number | null
  householdId?: number | null
}
export interface GlobalSearchItem {
  type: 'apartment' | 'household' | 'resident' | 'payment'
  id: number
  title: string
  subtitle?: string | null
  link: string
}

// ── Sinh danh sách phải thu ──────────────────────────────────
export interface FeeChargeGenerateInput {
  feeCollectionId: number
  feeCategoryId: number
  mode: 'auto' | 'fixed'
  fixedQuantity?: number | null
  onlyOccupied: boolean
  dueDate?: string | null
  preview: boolean
}
export interface FeeChargeGenerateRow {
  apartmentId: number
  apartmentCode: string
  building: string
  householdCode?: string | null
  headOfHousehold?: string | null
  quantity: number
  amount: number
  exists: boolean
}
export interface FeeChargeGenerateResult {
  preview: boolean
  apartmentCount: number
  existingCount: number
  createdCount: number
  totalAmount: number
  dueDate: string
  rows: FeeChargeGenerateRow[]
}
export interface IssueResult {
  noticeCount: number
  skippedCount: number
  notifiedAccountCount: number
  totalAmount: number
}

// ── Giấy báo phí ─────────────────────────────────────────────
export interface FeeNoticeLine {
  feeCategoryName: string
  unit: string
  quantity: number
  unitPrice: number
  amount: number
  paidAmount: number
}
export interface FeeNotice {
  id: number
  type: 'Notice' | 'Reminder'
  feeCollectionId: number
  feeCollectionName: string
  month: number
  year: number
  apartmentId: number
  apartmentCode: string
  building: string
  householdCode?: string | null
  headOfHousehold?: string | null
  totalAmount: number
  outstandingAmount: number
  dueDate: string
  message?: string | null
  issuedAt: string
  issuedByUsername: string
  lines: FeeNoticeLine[]
  isOverdue: boolean
}

// ── Thông báo ────────────────────────────────────────────────
export interface AppNotification {
  id: number
  type: string
  severity: 'info' | 'success' | 'warning' | 'danger'
  title: string
  message: string
  link?: string | null
  createdAt: string
  readAt?: string | null
  isRead: boolean
}
export interface AlertCollection {
  id: number
  name: string
  dueDate: string
  chargeCount: number
  outstandingAmount: number
}
export interface StaffAlerts {
  overdueChargeCount: number
  overdueAmount: number
  overdueApartmentCount: number
  dueSoonChargeCount: number
  dueSoonAmount: number
  openCollectionsWithoutNotice: AlertCollection[]
  openCollectionsPastDue: AlertCollection[]
}

// ── Thống kê mở rộng ─────────────────────────────────────────
export interface RevenueBucket {
  period: string
  label: string
  amount: number
  paymentCount: number
  categories: { feeCategoryId: number; feeCategoryName: string; amount: number }[]
}
export interface RevenueReport {
  groupBy: 'month' | 'quarter' | 'year'
  from: string
  to: string
  totalAmount: number
  paymentCount: number
  buckets: RevenueBucket[]
}
export interface AgingBucket {
  key: string
  label: string
  chargeCount: number
  apartmentCount: number
  amount: number
}
export interface OverdueApartment {
  apartmentId: number
  apartmentCode: string
  building: string
  householdCode?: string | null
  headOfHousehold?: string | null
  phoneNumber?: string | null
  chargeCount: number
  overdueAmount: number
  maxDaysOverdue: number
  lastReminderAt?: string | null
}
export interface AgingReport {
  totalOutstanding: number
  overdueAmount: number
  overdueApartmentCount: number
  buckets: AgingBucket[]
  apartments: OverdueApartment[]
}

// ── Cổng cư dân ──────────────────────────────────────────────
export interface PortalSummary {
  householdId: number
  householdCode: string
  apartmentId: number
  apartmentCode: string
  building: string
  outstandingAmount: number
  overdueAmount: number
  overdueChargeCount: number
  unpaidChargeCount: number
  nextDueDate?: string | null
  nextDueAmount: number
  paidThisYear: number
  unreadNotificationCount: number
}
export interface PortalMember {
  id: number
  fullName: string
  dateOfBirth?: string | null
  gender: string
  relationship: string
  isHouseholdHead: boolean
  status: string
}
export interface PortalHousehold {
  id: number
  householdCode: string
  apartmentCode: string
  building: string
  floor: number
  area: number
  createdAt: string
  members: PortalMember[]
}
