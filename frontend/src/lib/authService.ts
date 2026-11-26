/**
 * authService.ts
 * Xác thực, hồ sơ cá nhân, đổi mật khẩu và quản lý tài khoản (AuthController & UsersController).
 */
import apiClient from './apiClient'
import { getPaged, type Params } from './services'
import type {
  CreateUserRequest,
  LoginRequest,
  LoginResponse,
  UpdateUserRequest,
  UserResponse,
} from '../types/auth'

// POST /api/auth/login — AllowAnonymous
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', data)
  return res.data
}

// GET /api/auth/me — mọi vai trò
export async function getMe(): Promise<UserResponse> {
  return (await apiClient.get<UserResponse>('/auth/me')).data
}

// PUT /api/auth/me — tự cập nhật họ tên, email (PBI-024)
export async function updateMe(data: { fullName: string; email: string }): Promise<UserResponse> {
  return (await apiClient.put<UserResponse>('/auth/me', data)).data
}

// POST /api/auth/change-password — bắt buộc mật khẩu hiện tại (PBI-023)
export async function changePassword(data: { currentPassword: string; newPassword: string }): Promise<UserResponse> {
  return (await apiClient.post<UserResponse>('/auth/change-password', data)).data
}

// ── Quản lý tài khoản — Admin ───────────────────────────────
export function getUsers(params?: Params) {
  return getPaged<UserResponse>('/users', params)
}

export async function createUser(data: CreateUserRequest): Promise<UserResponse> {
  return (await apiClient.post<UserResponse>('/users', data)).data
}

export async function updateUser(id: number, data: UpdateUserRequest): Promise<UserResponse> {
  return (await apiClient.put<UserResponse>(`/users/${id}`, data)).data
}

export async function lockUser(id: number): Promise<void> {
  await apiClient.patch(`/users/${id}/lock`)
}

export async function unlockUser(id: number): Promise<void> {
  await apiClient.patch(`/users/${id}/unlock`)
}
