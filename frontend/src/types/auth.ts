// ============================================================
// Auth & User types — ánh xạ trực tiếp với AccountDtos.cs
// ASP.NET Core System.Text.Json mặc định serialize theo camelCase.
// ============================================================

export interface UserResponse {
  id: number
  username: string
  fullName: string
  email: string
  role: 'Admin' | 'User'
  isActive: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  expiresAtUtc: string
  user: UserResponse
}

export interface UpdateUserRequest {
  fullName: string
  email: string
  role: 'Admin' | 'User'
  newPassword?: string
}

export interface CreateUserRequest {
  username: string
  password: string
  fullName: string
  email: string
  role: 'Admin' | 'User'
}
