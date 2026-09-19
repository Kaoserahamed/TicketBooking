import api from './client'

// Backend shape: toPublicUser() — see backend/src/utils/serialize.js
export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  role: 'USER' | 'ADMIN' | 'EVENT_MANAGER' | 'VENUE_MANAGER' | 'SUPPORT'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'BLOCKED'
  emailVerified: boolean
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TokenPair {
  tokenType: 'Bearer'
  accessToken: string
  refreshToken: string
  accessTokenExpiresIn: string
  refreshTokenExpiresAt: string
}

// Backend envelope: { status: 'ok', user, tokens }
export interface AuthResponse {
  status: 'ok'
  user: User
  tokens: TokenPair
}

export interface RegisterInput {
  name: string
  email: string
  phone?: string
  password: string
}

export const authApi = {
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', input)
    return data
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    return data
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken })
    return data
  },

  logout: async (refreshToken?: string | null) => {
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {})
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<{ status: string; user: User }>('/auth/me')
    return data.user
  },

  verifyEmail: async (token: string): Promise<User> => {
    const { data } = await api.post<{ status: string; message: string; user: User }>(
      '/auth/verify-email',
      { token }
    )
    return data.user
  },

  resendVerification: async (): Promise<string> => {
    const { data } = await api.post<{ status: string; message: string }>(
      '/auth/resend-verification'
    )
    return data.message
  },

  forgotPassword: async (email: string): Promise<string> => {
    const { data } = await api.post<{ status: string; message: string }>('/auth/forgot-password', {
      email,
    })
    return data.message
  },

  resetPassword: async (token: string, newPassword: string): Promise<string> => {
    const { data } = await api.post<{ status: string; message: string }>('/auth/reset-password', {
      token,
      newPassword,
    })
    return data.message
  },
}

export interface UpdateProfileInput {
  name?: string
  email?: string
  phone?: string | null
}

export const userApi = {
  getMe: async (): Promise<User> => {
    const { data } = await api.get<{ status: string; user: User }>('/users/me')
    return data.user
  },

  updateProfile: async (input: UpdateProfileInput): Promise<User> => {
    const { data } = await api.put<{ status: string; user: User }>('/users/me', input)
    return data.user
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<string> => {
    const { data } = await api.put<{ status: string; message: string }>('/users/me/password', {
      currentPassword,
      newPassword,
    })
    return data.message
  },
}
