/**
 * authService.ts
 * Các hàm gọi API liên quan đến xác thực và quản lý tài khoản.
 * Chỉ gọi đúng endpoint thực tế của AuthController & UsersController.
 */
import apiClient from './apiClient'
import type {
  LoginRequest,
  LoginResponse,
  UpdateUserRequest,
  CreateUserRequest,
  UserResponse,
} from '../types/auth'

// POST /api/auth/login — AllowAnonymous
export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', data)
  return res.data
}

// GET /api/users — Admin only
export async function getUsers(): Promise<UserResponse[]> {
  const res = await apiClient.get<UserResponse[]>('/users')
  return res.data
}

// GET /api/users/{id} — Admin only
export async function getUserById(id: number): Promise<UserResponse> {
  const res = await apiClient.get<UserResponse>(`/users/${id}`)
  return res.data
}

// POST /api/users — Admin only (or anonymous khi chưa có user nào)
export async function createUser(data: CreateUserRequest): Promise<UserResponse> {
  const res = await apiClient.post<UserResponse>('/users', data)
  return res.data
}

// PUT /api/users/{id} — Admin only
export async function updateUser(id: number, data: UpdateUserRequest): Promise<UserResponse> {
  const res = await apiClient.put<UserResponse>(`/users/${id}`, data)
  return res.data
}

// PATCH /api/users/{id}/lock — Admin only
export async function lockUser(id: number): Promise<void> {
  await apiClient.patch(`/users/${id}/lock`)
}
