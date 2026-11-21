import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { router } from '../router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { Accept: 'application/json' },
  timeout: 20000,
})

let refreshRequest = null
let tokenRefreshTimer = null
const refreshRetryDelayMs = 10_000

function saveTokenPair(data) {
  localStorage.setItem('access_token', data.token)
  localStorage.setItem('refresh_token', data.refresh_token)
  localStorage.setItem('access_token_expires_at', data.expires_at)
  localStorage.setItem('access_token_issued_at', String(Date.now()))
  scheduleTokenRefresh()
}

function refreshLeadMs(expiresAt, issuedAt) {
  const lifetime = expiresAt - issuedAt
  if (!Number.isFinite(lifetime) || lifetime <= 0) return 0
  return Math.max(1000, Math.min(60_000, lifetime * 0.1))
}

function needsTokenRefresh() {
  const expiresAt = Date.parse(localStorage.getItem('access_token_expires_at') || '')
  const issuedAt = Number(localStorage.getItem('access_token_issued_at'))
  return !Number.isFinite(expiresAt)
    || !Number.isFinite(issuedAt)
    || expiresAt <= Date.now() + refreshLeadMs(expiresAt, issuedAt)
}

async function refreshAccessToken(rejectedAccessToken, force = false) {
  const refresh = async () => {
    const accessToken = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    if (!accessToken || !refreshToken) throw new Error('The session has expired.')
    if (accessToken !== rejectedAccessToken) return accessToken

    const expiresAt = Date.parse(localStorage.getItem('access_token_expires_at') || '')
    const issuedAt = Number(localStorage.getItem('access_token_issued_at'))
    if (!force && Number.isFinite(expiresAt) && Number.isFinite(issuedAt)
      && expiresAt > Date.now() + refreshLeadMs(expiresAt, issuedAt)) {
      return accessToken
    }

    try {
      const { data } = await axios.post(
        `${api.defaults.baseURL}/token/refresh`,
        { refresh_token: refreshToken },
        { headers: { Accept: 'application/json' }, timeout: api.defaults.timeout },
      )
      saveTokenPair(data)
      return data.token
    } catch (error) {
      const currentToken = localStorage.getItem('access_token')
      if (localStorage.getItem('refresh_token') !== refreshToken && currentToken) return currentToken
      throw error
    }
  }

  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('bizkua-api-token-refresh', refresh)
  }
  return refresh()
}

function getRefreshRequest(accessToken, force = false) {
  if (!refreshRequest) {
    refreshRequest = refreshAccessToken(accessToken, force).finally(() => {
      refreshRequest = null
    })
  }
  return refreshRequest
}

async function clearSessionAndRedirect() {
  const auth = useAuthStore()
  auth.clearSession()
  if (router.currentRoute.value.name !== 'login') await router.push({ name: 'login' })
}

function isExpiredRefreshToken(error) {
  return [401, 422].includes(error.response?.status)
}

function retryTokenRefresh(error) {
  if (isExpiredRefreshToken(error)) {
    return clearSessionAndRedirect().catch((redirectError) => {
      console.error('Unable to redirect after the session expired.', redirectError)
    })
  }

  console.error('Unable to refresh the session; retrying shortly.', error)
  if (tokenRefreshTimer !== null) clearTimeout(tokenRefreshTimer)
  tokenRefreshTimer = setTimeout(() => {
    tokenRefreshTimer = null
    const currentToken = localStorage.getItem('access_token')
    if (!currentToken || !localStorage.getItem('refresh_token')) return
    getRefreshRequest(currentToken).catch(retryTokenRefresh)
  }, refreshRetryDelayMs)
}

function scheduleTokenRefresh() {
  if (tokenRefreshTimer !== null) clearTimeout(tokenRefreshTimer)
  tokenRefreshTimer = null

  const accessToken = localStorage.getItem('access_token')
  if (!accessToken || !localStorage.getItem('refresh_token')) return

  const expiresAt = Date.parse(localStorage.getItem('access_token_expires_at') || '')
  const issuedAt = Number(localStorage.getItem('access_token_issued_at'))
  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt)) return

  const delay = Math.max(0, expiresAt - Date.now() - refreshLeadMs(expiresAt, issuedAt))
  tokenRefreshTimer = setTimeout(() => {
    tokenRefreshTimer = null
    const currentToken = localStorage.getItem('access_token')
    if (!currentToken || !localStorage.getItem('refresh_token')) return
    getRefreshRequest(currentToken).catch(retryTokenRefresh)
  }, delay)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if ([
      'access_token',
      'refresh_token',
      'access_token_expires_at',
      'access_token_issued_at',
    ].includes(event.key || '')) {
      scheduleTokenRefresh()
    }
  })
  scheduleTokenRefresh()
}

api.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('access_token')
  if (token) scheduleTokenRefresh()
  const publicEndpoint = ['/login', '/forgot-password', '/reset-password']
    .some((path) => config.url?.includes(path))

  if (token && localStorage.getItem('refresh_token') && !publicEndpoint && needsTokenRefresh()) {
    try {
      token = await getRefreshRequest(token)
    } catch (refreshError) {
      await retryTokenRefresh(refreshError)
      return Promise.reject(refreshError)
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => {
    if (response.config.url?.includes('/session/activity') && response.data?.expires_at) {
      localStorage.setItem('access_token_expires_at', response.data.expires_at)
      scheduleTokenRefresh()
    }
    return response
  },
  async (error) => {
    const request = error.config
    if (
      error.response?.status !== 401
      || !localStorage.getItem('access_token')
      || !localStorage.getItem('refresh_token')
      || !request
      || request._retry
      || request.url?.includes('/token/refresh')
      || request.url?.includes('/login')
    ) {
      return Promise.reject(error)
    }

    request._retry = true
    try {
      const authorization = request.headers?.Authorization || request.headers?.authorization
      const rejectedAccessToken = typeof authorization === 'string'
        ? authorization.replace(/^Bearer\s+/i, '')
        : ''
      const token = await getRefreshRequest(rejectedAccessToken, true)
      request.headers.Authorization = `Bearer ${token}`
      return api(request)
    } catch (refreshError) {
      await retryTokenRefresh(refreshError)
      return Promise.reject(refreshError)
    }
  },
)

export default api
