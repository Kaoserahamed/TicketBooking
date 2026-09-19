import api from './client'

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  role: 'USER' | 'ADMIN'
  emailVerified: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },

  register: async (data: {
    email: string
    password: string
    firstName: string
    lastName: string
  }): Promise<AuthResponse> => {
    const { data: response } = await api.post('/auth/register', data)
    return response
  },

  logout: async (refreshToken: string) => {
    await api.post('/auth/logout', { refreshToken })
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get('/auth/me')
    return data
  },

  updateProfile: async (data: { firstName?: string; lastName?: string; email?: string }): Promise<User> => {
    const { data: response } = await api.put('/users/me', data)
    return response
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await api.put('/users/me/password', { currentPassword, newPassword })
  },
}
