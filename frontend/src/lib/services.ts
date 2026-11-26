/**
 * services.ts
 * Hàm gọi API cho các module nghiệp vụ. Mỗi hàm ánh xạ đúng 1 endpoint trong src/BlueMoon.API/Controllers.
 * Danh sách lớn dùng getPaged() → server-side paging (header X-Total-Count).
 * (Auth & Users nằm ở authService.ts)
 */
import apiClient from './apiClient'
import type {
  AgingReport,
  AppNotification,
  Apartment,
  ApartmentInput,
  ApartmentStatistics,
  CollectionStatistics,
  FeeCategory,
  FeeCategoryCreateInput,
  FeeCategoryUpdateInput,
  FeeCharge,
  FeeChargeCreateInput,
  FeeChargeDebtSummary,
  FeeChargeGenerateInput,
  FeeChargeGenerateResult,
  FeeChargeUpdateInput,
  FeeCollection,
  FeeCollectionCreateInput,
  FeeCollectionStatus,
  FeeCollectionUpdateInput,
  FeeNotice,
  FinancialSearchResult,
  FinancialStatistics,
  GlobalSearchItem,
  Household,
  HouseholdCreateInput,
  HouseholdSearchResult,
  HouseholdUpdateInput,
  IssueResult,
  LookupItem,
  LookupKind,
  Paged,
  Payment,
  PaymentCreateInput,
  PaymentDetailHistory,
  PaymentSearchResult,
  PortalHousehold,
  PortalSummary,
  Resident,
  ResidentHistory,
  ResidentHistoryInput,
  ResidentInput,
  RevenueReport,
  StaffAlerts,
} from '../types/models'
import type { ProvisionedAccount } from '../types/auth'

export type Params = Record<string, string | number | boolean | null | undefined>

/** Bỏ các tham số rỗng để query string gọn. */
function clean(params?: object): Params | undefined {
  if (!params) return undefined
  const out: Params = {}
  for (const [k, v] of Object.entries(params as Params)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = v
  }
  return out
}

async function get<T>(url: string, params?: object): Promise<T> {
  const res = await apiClient.get<T>(url, { params: clean(params) })
  return res.data
}

function headerNumber(headers: Record<string, unknown>, name: string): number | undefined {
  const raw = headers[name]
  if (raw === undefined || raw === null || raw === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** GET có phân trang: đọc X-Total-Count và các header tổng tiền (nếu có). */
export async function getPaged<T>(url: string, params?: object): Promise<Paged<T>> {
  const res = await apiClient.get<T[]>(url, { params: clean({ page: 1, pageSize: 20, ...params }) })
  const headers = res.headers as Record<string, unknown>
  return {
    items: res.data,
    total: headerNumber(headers, 'x-total-count') ?? res.data.length,
    totalAmount: headerNumber(headers, 'x-total-amount'),
    paidAmount: headerNumber(headers, 'x-paid-amount'),
    outstandingAmount: headerNumber(headers, 'x-outstanding-amount'),
  }
}

/** Tải toàn bộ các trang (dùng cho xuất CSV). Giới hạn an toàn 20.000 dòng. */
export async function fetchAllPages<T>(url: string, params?: object, onProgress?: (loaded: number, total: number) => void): Promise<T[]> {
  const pageSize = 500
  const first = await getPaged<T>(url, { ...params, page: 1, pageSize })
  const all = [...first.items]
  const total = Math.min(first.total, 20000)
  onProgress?.(all.length, total)
  for (let page = 2; all.length < total; page++) {
    const next = await getPaged<T>(url, { ...params, page, pageSize })
    if (next.items.length === 0) break
    all.push(...next.items)
    onProgress?.(all.length, total)
  }
  return all
}

// ── Lookups & tìm kiếm toàn cục ─────────────────────────────
export const lookupsApi = {
  search: (kind: LookupKind, params: Params) => get<LookupItem[]>(`/lookups/${kind}`, params),
  buildings: () => get<string[]>('/lookups/buildings'),
}

export const globalSearch = (q: string) => get<GlobalSearchItem[]>('/search-statistics/global', { q, limit: 5 })

// ── Apartments ───────────────────────────────────────────────
export const apartmentsApi = {
  list: (params?: Params) => getPaged<Apartment>('/apartments', params),
  get: (id: number) => get<Apartment>(`/apartments/${id}`),
  create: async (data: ApartmentInput) => (await apiClient.post<Apartment>('/apartments', data)).data,
  update: async (id: number, data: ApartmentInput) => {
    await apiClient.put(`/apartments/${id}`, data)
  },
  remove: async (id: number) => {
    await apiClient.delete(`/apartments/${id}`)
  },
}

// ── Households ───────────────────────────────────────────────
export const householdsApi = {
  list: (params?: Params) => getPaged<Household>('/households', params),
  get: (id: number) => get<Household>(`/households/${id}`),
  create: async (data: HouseholdCreateInput) => (await apiClient.post<Household>('/households', data)).data,
  update: async (id: number, data: HouseholdUpdateInput) => {
    await apiClient.put(`/households/${id}`, data)
  },
  remove: async (id: number) => {
    await apiClient.delete(`/households/${id}`)
  },
  provisionAccount: async (id: number) =>
    (await apiClient.post<ProvisionedAccount>(`/households/${id}/account`)).data,
  provisionAccounts: async (building?: string) =>
    (await apiClient.post<ProvisionedAccount[]>('/households/accounts/bulk', null, { params: clean({ building }) })).data,
}

// ── Residents ────────────────────────────────────────────────
export const residentsApi = {
  list: (params?: Params) => getPaged<Resident>('/residents', params),
  get: (id: number) => get<Resident>(`/residents/${id}`),
  create: async (data: ResidentInput) => (await apiClient.post<Resident>('/residents', data)).data,
  update: async (id: number, data: ResidentInput) => {
    await apiClient.put(`/residents/${id}`, data)
  },
  remove: async (id: number) => {
    await apiClient.delete(`/residents/${id}`)
  },
}

// ── Residence histories — Admin ──────────────────────────────
export const residentHistoriesApi = {
  list: (params?: Params) => getPaged<ResidentHistory>('/residence-histories', params),
  byResident: (residentId: number) => get<ResidentHistory[]>(`/residence-histories/resident/${residentId}`),
  create: async (data: ResidentHistoryInput) =>
    (await apiClient.post<ResidentHistory>('/residence-histories', data)).data,
}

// ── Fee categories ───────────────────────────────────────────
export const feeCategoriesApi = {
  list: (filter?: { isActive?: boolean; name?: string }) => get<FeeCategory[]>('/feecategories', filter),
  create: async (data: FeeCategoryCreateInput) =>
    (await apiClient.post<FeeCategory>('/feecategories', data)).data,
  update: async (id: number, data: FeeCategoryUpdateInput) => {
    await apiClient.put(`/feecategories/${id}`, data)
  },
  deactivate: async (id: number) => {
    await apiClient.patch(`/feecategories/${id}/deactivate`)
  },
  remove: async (id: number) => {
    await apiClient.delete(`/feecategories/${id}`)
  },
}

// ── Fee collections ──────────────────────────────────────────
export const feeCollectionsApi = {
  list: (filter?: Params) => get<FeeCollection[]>('/feecollections', filter),
  get: (id: number) => get<FeeCollection>(`/feecollections/${id}`),
  create: async (data: FeeCollectionCreateInput) =>
    (await apiClient.post<FeeCollection>('/feecollections', data)).data,
  update: async (id: number, data: FeeCollectionUpdateInput & { dueDate?: string | null }) => {
    await apiClient.put(`/feecollections/${id}`, data)
  },
  setStatus: async (id: number, status: FeeCollectionStatus) => {
    await apiClient.patch(`/feecollections/${id}/status`, { status })
  },
  remove: async (id: number) => {
    await apiClient.delete(`/feecollections/${id}`)
  },
  issueNotices: async (id: number, data: { message?: string | null; reissue?: boolean }) =>
    (await apiClient.post<IssueResult>(`/feecollections/${id}/notices`, data)).data,
  notices: (id: number, params?: Params) => get<FeeNotice[]>(`/feecollections/${id}/notices`, params),
}

// ── Fee charges ──────────────────────────────────────────────
export const feeChargesApi = {
  list: (params?: Params) => getPaged<FeeCharge>('/fee-charges', params),
  byApartment: (apartmentId: number, filter?: Params) =>
    get<FeeChargeDebtSummary>(`/fee-charges/apartment/${apartmentId}`, filter),
  create: async (data: FeeChargeCreateInput) => (await apiClient.post<FeeCharge>('/fee-charges', data)).data,
  generate: async (data: FeeChargeGenerateInput) =>
    (await apiClient.post<FeeChargeGenerateResult>('/fee-charges/generate', data)).data,
  remind: async (data: { apartmentIds?: number[] | null; message?: string | null }) =>
    (await apiClient.post<IssueResult>('/fee-charges/reminders', data)).data,
  update: async (id: number, data: FeeChargeUpdateInput) => {
    await apiClient.put(`/fee-charges/${id}`, data)
  },
  remove: async (id: number) => {
    await apiClient.delete(`/fee-charges/${id}`)
  },
}

// ── Payments ─────────────────────────────────────────────────
export const paymentsApi = {
  list: (params?: Params) => getPaged<Payment>('/payments', params),
  get: (id: number) => get<Payment>(`/payments/${id}`),
  byFeeCharge: (feeChargeId: number) => get<PaymentDetailHistory[]>(`/payments/fee-charge/${feeChargeId}`),
  nextReceiptNumber: async () => (await get<{ receiptNumber: string }>('/payments/next-receipt-number')).receiptNumber,
  create: async (data: PaymentCreateInput) => (await apiClient.post<Payment>('/payments', data)).data,
}

// ── Search & statistics ──────────────────────────────────────
export const searchApi = {
  households: (params?: Params) => getPaged<HouseholdSearchResult>('/search-statistics/households', params),
  charges: (params?: Params) => getPaged<FinancialSearchResult>('/search-statistics/charges', params),
  payments: (params?: Params) => getPaged<PaymentSearchResult>('/search-statistics/payments', params),
  collectionStats: (filter?: Params) => get<CollectionStatistics[]>('/search-statistics/statistics/collections', filter),
  financialStats: (filter?: Params) => get<FinancialStatistics>('/search-statistics/statistics/financial', filter),
  apartmentStats: (params?: Params) => getPaged<ApartmentStatistics>('/search-statistics/statistics/apartments', params),
  revenue: (params?: Params) => get<RevenueReport>('/search-statistics/statistics/revenue', params),
  aging: (params?: Params) => get<AgingReport>('/search-statistics/statistics/aging', params),
}

// ── Notifications ────────────────────────────────────────────
export const notificationsApi = {
  list: (params?: Params) => getPaged<AppNotification>('/notifications', params),
  unreadCount: async () => (await get<{ count: number }>('/notifications/unread-count')).count,
  markRead: async (id: number) => {
    await apiClient.post(`/notifications/${id}/read`)
  },
  markAllRead: async () => {
    await apiClient.post('/notifications/read-all')
  },
  alerts: () => get<StaffAlerts>('/notifications/alerts'),
}

// ── Cổng cư dân ──────────────────────────────────────────────
export const portalApi = {
  summary: () => get<PortalSummary>('/portal/summary'),
  household: () => get<PortalHousehold>('/portal/household'),
  charges: (params?: Params) => getPaged<FeeCharge>('/portal/charges', params),
  payments: (params?: Params) => getPaged<Payment>('/portal/payments', params),
  notices: (params?: Params) => get<FeeNotice[]>('/portal/notices', params),
}
