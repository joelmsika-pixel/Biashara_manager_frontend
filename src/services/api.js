import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { router } from '../router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { Accept: 'application/json' },
  timeout: 20000,
})

let refreshRequest = null

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
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
      if (!refreshRequest) {
        refreshRequest = axios.post(
          `${api.defaults.baseURL}/token/refresh`,
          { refresh_token: localStorage.getItem('refresh_token') },
          { headers: { Accept: 'application/json' }, timeout: api.defaults.timeout },
        ).then(({ data }) => {
          localStorage.setItem('access_token', data.token)
          localStorage.setItem('refresh_token', data.refresh_token)
          return data.token
        }).finally(() => {
          refreshRequest = null
        })
      }

      const token = await refreshRequest
      request.headers.Authorization = `Bearer ${token}`
      return api(request)
    } catch (refreshError) {
      const auth = useAuthStore()
      auth.clearSession()
      if (router.currentRoute.value.name !== 'login') await router.push({ name: 'login' })
      return Promise.reject(refreshError)
    }
  },
)

export default api
