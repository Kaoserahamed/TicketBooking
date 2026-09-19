import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import api, {
  clearTokens,
  extractErrorMessage,
  getRefreshToken,
  getToken,
  setTokens,
} from '../api/client'

// The interceptors are registered at import time, so these tests drive the real
// instance and swap in a stub adapter instead of hitting the network.
const defaultAdapter = api.defaults.adapter

function okResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config }
}

function unauthorizedError(config: InternalAxiosRequestConfig) {
  return Object.assign(new Error('Request failed with status code 401'), {
    isAxiosError: true,
    config,
    response: { status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config },
  })
}

afterEach(() => {
  api.defaults.adapter = defaultAdapter
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('token storage helpers', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips the access and refresh tokens', () => {
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()

    setTokens('access-123', 'refresh-123')

    expect(getToken()).toBe('access-123')
    expect(getRefreshToken()).toBe('refresh-123')

    clearTokens()

    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})

describe('extractErrorMessage', () => {
  it('prefers the backend envelope message', () => {
    expect(
      extractErrorMessage({ response: { data: { message: 'Seats taken' } } }, 'fallback')
    ).toBe('Seats taken')
  })

  it('falls back to the first validation error', () => {
    const error = { response: { data: { errors: [{ message: 'email must be valid' }] } } }
    expect(extractErrorMessage(error, 'fallback')).toBe('email must be valid')
  })

  it('uses the Error message when there is no envelope', () => {
    expect(extractErrorMessage(new Error('socket closed'), 'fallback')).toBe('socket closed')
  })

  it('returns the fallback for unknown error shapes', () => {
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback')
    expect(extractErrorMessage('boom', 'fallback')).toBe('fallback')
    expect(extractErrorMessage({ response: { data: {} } }, 'fallback')).toBe('fallback')
  })
})

describe('request interceptor', () => {
  beforeEach(() => localStorage.clear())

  it('attaches the stored bearer token', async () => {
    setTokens('access-123', 'refresh-123')
    let seen: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      seen = config
      return okResponse(config, { status: 'ok' })
    }) as AxiosAdapter

    const response = await api.get('/events')

    expect(response.data).toEqual({ status: 'ok' })
    expect(seen?.headers.Authorization).toBe('Bearer access-123')
  })

  it('sends no authorization header when there is no token', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      seen = config
      return okResponse(config, { status: 'ok' })
    }) as AxiosAdapter

    await api.get('/events')

    expect(seen?.headers.Authorization).toBeUndefined()
  })
})

describe('response interceptor — silent token refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    setTokens('stale-access', 'refresh-123')
  })

  it('refreshes once on 401 and replays the original request with the new token', async () => {
    const configs: InternalAxiosRequestConfig[] = []
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      configs.push(config)
      if (configs.length === 1) throw unauthorizedError(config)
      return okResponse(config, { status: 'ok', replayed: true })
    }) as AxiosAdapter
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { status: 'ok', tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
    } as AxiosResponse)

    const response = await api.get('/bookings')

    expect(response.data).toEqual({ status: 'ok', replayed: true })
    expect(post).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      { refreshToken: 'refresh-123' },
      { withCredentials: true }
    )
    expect(getToken()).toBe('new-access')
    expect(getRefreshToken()).toBe('new-refresh')
    expect(configs).toHaveLength(2)
    expect(configs[1]?.headers.Authorization).toBe('Bearer new-access')
  })

  it('accepts a refresh response that is not wrapped in the envelope', async () => {
    const configs: InternalAxiosRequestConfig[] = []
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      configs.push(config)
      if (configs.length === 1) throw unauthorizedError(config)
      return okResponse(config, { status: 'ok' })
    }) as AxiosAdapter
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { accessToken: 'flat-access', refreshToken: 'flat-refresh' },
    } as AxiosResponse)

    await api.get('/bookings')

    expect(getToken()).toBe('flat-access')
    expect(getRefreshToken()).toBe('flat-refresh')
  })

  it('does not attempt a refresh for the auth endpoints themselves', async () => {
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    }) as AxiosAdapter
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: {} } as AxiosResponse)

    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'wrong' })).rejects.toThrow()

    expect(post).not.toHaveBeenCalled()
  })

  it('does not refresh when no refresh token is stored', async () => {
    clearTokens()
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    }) as AxiosAdapter
    const post = vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: {} } as AxiosResponse)

    await expect(api.get('/bookings')).rejects.toThrow()

    expect(post).not.toHaveBeenCalled()
  })

  it('only refreshes once, then surfaces the error for a still-unauthorized replay', async () => {
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    }) as AxiosAdapter
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } },
    } as AxiosResponse)

    await expect(api.get('/bookings')).rejects.toThrow()

    expect(post).toHaveBeenCalledTimes(1)
  })

  it('clears stored tokens when the refresh call itself fails', async () => {
    api.defaults.adapter = (async (config: InternalAxiosRequestConfig) => {
      throw unauthorizedError(config)
    }) as AxiosAdapter
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('refresh endpoint down'))

    // NODE_ENV=test disables the hard redirect to /login, so the original
    // error is rethrown after the stale session is dropped.
    await expect(api.get('/bookings')).rejects.toThrow()

    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })
})
