<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRouter } from 'vue-router'
import api from './services/api'
import { useAuthStore } from './stores/auth'

const idleTimeoutMs = 12 * 60 * 60 * 1000
const sessionActivityDebounceMs = 1000
const sessionHeartbeatIntervalMs = 60 * 1000
const activityEvents = ['pointerdown', 'keydown', 'touchstart', 'scroll']
const activityListenerOptions = { capture: true, passive: true }
const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
let idleTimer = null
let activitySyncTimer = null
let sessionHeartbeatTimer = null
let lastUserActivityAt = 0

function stopIdleTracking() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (activitySyncTimer !== null) {
    clearTimeout(activitySyncTimer)
    activitySyncTimer = null
  }
  if (sessionHeartbeatTimer !== null) {
    clearTimeout(sessionHeartbeatTimer)
    sessionHeartbeatTimer = null
  }
  for (const eventName of activityEvents) {
    window.removeEventListener(eventName, resetIdleTimer, activityListenerOptions)
  }
}

function resetIdleTimer() {
  if (!auth.user) return
  lastUserActivityAt = Date.now()
  if (idleTimer !== null) clearTimeout(idleTimer)
  idleTimer = setTimeout(signOutAfterInactivity, idleTimeoutMs)
  if (activitySyncTimer !== null) clearTimeout(activitySyncTimer)
  activitySyncTimer = setTimeout(() => {
    activitySyncTimer = null
    api.post('/session/activity').catch((error) => {
      console.error('Unable to extend the server session after user activity.', error)
    })
  }, sessionActivityDebounceMs)
  scheduleSessionHeartbeat()
}

function scheduleSessionHeartbeat() {
  if (sessionHeartbeatTimer !== null) return
  sessionHeartbeatTimer = setTimeout(() => {
    sessionHeartbeatTimer = null
    if (!auth.user || Date.now() - lastUserActivityAt >= sessionHeartbeatIntervalMs) return
    api.post('/session/activity').catch((error) => {
      console.error('Unable to extend the server session after user activity.', error)
    })
    scheduleSessionHeartbeat()
  }, sessionHeartbeatIntervalMs)
}

async function signOutAfterInactivity() {
  idleTimer = null
  const results = await Promise.allSettled([
    auth.logout(),
    router.replace({ name: 'login' }),
  ])
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Automatic sign-out could not be completed.', result.reason)
    }
  }
}

function startIdleTracking() {
  stopIdleTracking()
  for (const eventName of activityEvents) {
    window.addEventListener(eventName, resetIdleTimer, activityListenerOptions)
  }
  resetIdleTimer()
}

watch(
  () => auth.user,
  (user) => {
    if (user) startIdleTracking()
    else stopIdleTracking()
  },
  { immediate: true },
)

onMounted(() => auth.initialize())
onBeforeUnmount(stopIdleTracking)
</script>

<template>
  <RouterView />
  <div v-if="auth.preparingDashboard" class="dashboard-preparing-overlay" role="status" aria-live="polite">
    <div class="dashboard-preparing-content">
      <span class="dashboard-preparing-spinner" aria-hidden="true"></span>
      <p class="dashboard-preparing-message">{{ t('pleaseWait') }}</p>
      <p v-if="auth.dashboardCountdownSeconds > 0" class="dashboard-countdown">
        {{ t('dashboardCountdown', { seconds: auth.dashboardCountdownSeconds }) }}
      </p>
    </div>
  </div>
</template>
