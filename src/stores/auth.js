import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const preparingDashboard = ref(false)
  const dashboardCountdownSeconds = ref(5)
  const dashboardDataReady = ref(false)
  let dashboardCountdownTimer = null
  let dashboardCountdownEndsAt = 0
  let initialized = false

  function stopDashboardCountdown() {
    if (dashboardCountdownTimer !== null) {
      clearInterval(dashboardCountdownTimer)
      dashboardCountdownTimer = null
    }
  }

  function clearSession() {
    user.value = null
    cancelDashboardPreparation()
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('access_token_expires_at')
    localStorage.removeItem('access_token_issued_at')
  }

  function startDashboardPreparation() {
    stopDashboardCountdown()
    preparingDashboard.value = true
    dashboardDataReady.value = false
    dashboardCountdownSeconds.value = 5
    dashboardCountdownEndsAt = Date.now() + 5000
    dashboardCountdownTimer = setInterval(() => {
      dashboardCountdownSeconds.value = Math.max(
        0,
        Math.ceil((dashboardCountdownEndsAt - Date.now()) / 1000),
      )
      if (dashboardCountdownSeconds.value === 0) {
        stopDashboardCountdown()
        if (dashboardDataReady.value) preparingDashboard.value = false
      }
    }, 250)
  }

  function finishDashboardPreparation() {
    dashboardDataReady.value = true
    if (dashboardCountdownSeconds.value === 0) preparingDashboard.value = false
  }

  function cancelDashboardPreparation() {
    stopDashboardCountdown()
    preparingDashboard.value = false
    dashboardDataReady.value = false
  }

  async function initialize() {
    if (initialized) return
    initialized = true
    if (!localStorage.getItem('access_token')) return
    try {
      const { data } = await api.get('/me')
      user.value = data
    } catch (error) {
      if (error.response?.status !== 401) throw error
    }
  }

  async function login(credentials) {
    loading.value = true
    try {
      const { data } = await api.post('/login', credentials)
      localStorage.setItem('access_token', data.token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('access_token_expires_at', data.expires_at)
      localStorage.setItem('access_token_issued_at', String(Date.now()))
      user.value = data.user
      initialized = true
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    const token = localStorage.getItem('access_token')
    const refreshToken = localStorage.getItem('refresh_token')
    clearSession()
    initialized = true
    if (token || refreshToken) {
      await api.post('/logout', { refresh_token: refreshToken }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    }
  }

  return {
    user,
    loading,
    preparingDashboard,
    dashboardCountdownSeconds,
    initialize,
    login,
    logout,
    clearSession,
    startDashboardPreparation,
    finishDashboardPreparation,
    cancelDashboardPreparation,
  }
})
