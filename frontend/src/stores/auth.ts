import { create } from 'zustand'
import { authApi, User } from '../api/auth'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login(email, password)
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)
      set({
        token: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Login failed',
        isLoading: false,
      })
      throw error
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.register(data)
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)
      set({
        token: response.accessToken,
        refreshToken: response.refreshToken,
        user: response.user,
        isLoading: false,
      })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Registration failed',
        isLoading: false,
      })
      throw error
    }
  },

  logout: async () => {
    const { refreshToken } = get()
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({
      user: null,
      token: null,
      refreshToken: null,
    })
  },

  fetchUser: async () => {
    set({ isLoading: true, error: null })
    try {
      const user = await authApi.getMe()
      set({ user, isLoading: false })
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch user',
        isLoading: false,
        user: null,
      })
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
