/**
 * apiClient.ts
 * Axios instance dùng chung cho toàn ứng dụng.
 * - Tự động đính kèm Bearer token từ localStorage.
 * - Tự động điều hướng về /login khi nhận 401 Unauthorized (trừ request đăng nhập).
 * - Trả về message lỗi từ server một cách nhất quán.
 */
import axios, { AxiosError } from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

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
  (error: AxiosError<{ message?: string; title?: string }>) => {
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
    const serverMessage =
      error.response?.data?.message ||
      error.response?.data?.title ||
      error.message ||
      'Đã có lỗi xảy ra. Vui lòng thử lại.'
    return Promise.reject(new Error(serverMessage))
  },
)

export default apiClient
