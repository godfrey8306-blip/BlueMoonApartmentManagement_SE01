// ============================================================
// Auth & User types — ánh xạ trực tiếp với AccountDtos.cs
// ============================================================

/** Admin = Ban quản trị · User = Kế toán · Resident = Cư dân */
export type Role = 'Admin' | 'User' | 'Resident'

export interface UserResponse {
  id: number
  username: string
  fullName: string
  email: string
  role: Role
  isActive: boolean
  householdId?: number | null
  householdCode?: string | null
  apartmentCode?: string | null
  mustChangePassword?: boolean
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
  role: Role
  newPassword?: string
  householdId?: number | null
}

export interface CreateUserRequest {
  username: string
  password: string
  fullName: string
  email: string
  role: Role
  householdId?: number | null
}

export interface ProvisionedAccount {
  userId: number
  householdId: number
  householdCode: string
  apartmentCode: string
  username: string
  fullName: string
  temporaryPassword: string
}
