import { create } from 'zustand'
import { authApi, userApi, User, RegisterInput, UpdateProfileInput } from '../api/auth'
import { clearTokens, extractErrorMessage, getRefreshToken, setTokens } from '../api/client'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  logout: () => Promise<void>
  fetchUser: () => Promise<void>
  updateProfile: (data: UpdateProfileInput) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>
  clearError: () => void
}

function readStoredTokens(): { token: string | null; refreshToken: string | null } {
  if (typeof window === 'undefined') return { token: null, refreshToken: null }
  return {
    token: localStorage.getItem('accessToken'),
    refreshToken: localStorage.getItem('refreshToken'),
  }
}

function applySession(user: User, tokens: { accessToken: string; refreshToken: string }) {
  setTokens(tokens.accessToken, tokens.refreshToken)
  return {
    user,
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  ...readStoredTokens(),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.login(email, password)
      set({ ...applySession(response.user, response.tokens), isLoading: false })
    } catch (error) {
      set({ error: extractErrorMessage(error, 'Login failed'), isLoading: false })
      throw error
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await authApi.register(data)
      set({ ...applySession(response.user, response.tokens), isLoading: false })
    } catch (error) {
      set({ error: extractErrorMessage(error, 'Registration failed'), isLoading: false })
      throw error
    }
  },

  logout: async () => {
    const refreshToken = getRefreshToken() ?? get().refreshToken
    try {
      await authApi.logout(refreshToken)
    } catch {
      // Logout is idempotent — never block the UI on a server error.
    }
    clearTokens()
    set({ user: null, token: null, refreshToken: null, error: null })
  },

  fetchUser: async () => {
    const token = get().token
    if (!token) {
      set({ user: null })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const user = await authApi.getMe()
      set({ user, isLoading: false })
    } catch (error) {
      clearTokens()
      set({
        error: extractErrorMessage(error, 'Failed to fetch user'),
        isLoading: false,
        user: null,
        token: null,
        refreshToken: null,
      })
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const user = await userApi.updateProfile(data)
      set({ user, isLoading: false })
    } catch (error) {
      set({ error: extractErrorMessage(error, 'Failed to update profile'), isLoading: false })
      throw error
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ isLoading: true, error: null })
    try {
      const message = await userApi.changePassword(currentPassword, newPassword)
      // Backend revokes every session on password change — drop local tokens.
      clearTokens()
      set({ user: null, token: null, refreshToken: null, isLoading: false })
      return message
    } catch (error) {
      set({ error: extractErrorMessage(error, 'Failed to change password'), isLoading: false })
      throw error
    }
  },

  clearError: () => {
    set({ error: null })
  },
}))
