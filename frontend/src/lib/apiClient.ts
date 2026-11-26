/**
 * apiClient.ts
 * Axios instance dùng chung cho toàn ứng dụng.
 * - Tự động đính kèm Bearer token từ localStorage.
 * - Tự động điều hướng về /login khi nhận 401 Unauthorized (trừ request đăng nhập).
 * - Trả về message lỗi từ server một cách nhất quán.
 */
import axios, { AxiosError } from 'axios'
import { translateError } from './errors'

// Mặc định '/api' để đi qua Vite proxy (vite.config.ts → http://localhost:5016),
// tránh lỗi CORS vì backend chưa cấu hình AddCors().
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api'

type ErrorBody =
  | string
  | { message?: string; title?: string; errors?: Record<string, string[]> }
  | undefined

/** Trích xuất thông báo lỗi từ mọi dạng body mà ASP.NET Core trả về. */
function extractMessage(data: ErrorBody): string | undefined {
  if (!data) return undefined
  if (typeof data === 'string') {
    // DeveloperExceptionPage trả về cả stack trace dạng text → chỉ giữ dòng đầu, cắt ngắn.
    const firstLine = data.trim().split(/\r?\n/)[0]?.trim() ?? ''
    if (!firstLine || firstLine.startsWith('<')) return undefined
    return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine
  }
  if (data.message) return data.message
  if (data.errors) {
    const all = Object.values(data.errors).flat().filter(Boolean)
    if (all.length) return all.join(' ')
  }
  return data.title
}

export const TOKEN_KEY = 'access_token'
export const USER_KEY = 'current_user'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: gắn JWT token ──────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token && token !== 'undefined' && token !== 'null') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: xử lý lỗi tập trung ───────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => {
    const requestUrl = error.config?.url ?? ''
    const isLoginRequest = requestUrl.includes('/auth/login')

    if (error.response?.status === 401 && !isLoginRequest) {
      // Xóa token hết hạn và chuyển về /login nếu chưa ở trang login
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }

    // Trả về message từ server hoặc fallback message
    const status = error.response?.status
    let serverMessage = extractMessage(error.response?.data)
    if (status && status >= 500) {
      serverMessage = `Lỗi máy chủ (${status}). ${serverMessage ? `Chi tiết: ${serverMessage}` : 'Vui lòng thử lại sau.'}`
    } else if (!serverMessage) {
      if (!error.response) serverMessage = 'Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.'
      else if (status === 403) serverMessage = 'Bạn không có quyền thực hiện thao tác này.'
      else if (status === 404) serverMessage = 'Không tìm thấy dữ liệu.'
      else if (status === 409) serverMessage = 'Dữ liệu bị xung đột hoặc đã tồn tại.'
      else serverMessage = error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'
    }
    const wrapped = new Error(translateError(serverMessage)) as Error & { status?: number }
    wrapped.status = status
    return Promise.reject(wrapped)
  },
)

export default apiClient
