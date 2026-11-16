<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const { t } = useI18n()
onMounted(() => auth.initialize())
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
