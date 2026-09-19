import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

const ACCESS_KEY = 'accessToken'
const REFRESH_KEY = 'refreshToken'

// ---------------------------------------------------------------------------
// Token storage helpers (localStorage mirrors the httpOnly refresh cookie so
// the SPA can attach the Bearer access token; the cookie is managed by the
// backend for non-browser clients and tests).
// ---------------------------------------------------------------------------
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/** Pull a human message out of the backend error envelope. */
export function extractErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { message?: string; errors?: { message?: string }[] } } })
    ?.response?.data
  if (data?.message) return data.message
  if (data?.errors?.[0]?.message) return data.errors[0].message as string
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function isTestEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    // vitest sets NODE_ENV=test and VITEST=true
    (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true')
  )
}

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as { _retry?: boolean; url?: string; headers: { Authorization?: string } } | undefined

    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register')
    // On 401 try a single silent refresh (skipped for the auth endpoints
    // themselves to avoid a refresh loop).
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint &&
      getRefreshToken()
    ) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          { refreshToken: getRefreshToken() },
          { withCredentials: true },
        )
        // Backend envelope: { status:'ok', user, tokens:{ accessToken, refreshToken } }
        const tokens = data?.tokens ?? data
        setTokens(tokens.accessToken, tokens.refreshToken)
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
        return api(originalRequest)
      } catch {
        clearTokens()
        // Never hard-redirect during tests — it breaks happy-dom.
        if (typeof window !== 'undefined' && !isTestEnv() && window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
