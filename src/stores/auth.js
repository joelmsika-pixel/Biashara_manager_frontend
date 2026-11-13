import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const postLoginLoading = ref(false)
  let initialized = false

  function clearSession() {
    user.value = null
    postLoginLoading.value = false
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  function completePostLoginLoading() {
    postLoginLoading.value = false
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
      user.value = data.user
      initialized = true
      postLoginLoading.value = true
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      if (localStorage.getItem('access_token')) await api.post('/logout')
    } finally {
      clearSession()
      initialized = true
    }
  }

  return { user, loading, postLoginLoading, initialize, login, logout, clearSession, completePostLoginLoading }
})
