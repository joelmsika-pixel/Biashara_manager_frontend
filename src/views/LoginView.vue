<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BriefcaseBusiness, Languages, LockKeyhole } from '@lucide/vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const mode = ref(route.name === 'reset-password' ? 'reset' : 'login')
const email = ref(String(route.query.email || ''))
const password = ref('')
const passwordConfirmation = ref('')
const error = ref('')
const message = ref('')
const lockRemaining = ref(0)
let lockTimer

function lockStorageKey(value = email.value) {
  return `login_lock_until:${value.trim().toLowerCase()}`
}

function updateLockCountdown(until) {
  if (lockTimer) clearInterval(lockTimer)

  const update = () => {
    lockRemaining.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
    if (lockRemaining.value === 0) {
      clearInterval(lockTimer)
      lockTimer = undefined
      localStorage.removeItem(lockStorageKey())
    }
  }

  update()
  if (lockRemaining.value > 0) lockTimer = setInterval(update, 1000)
}

function restoreLoginLock() {
  if (mode.value !== 'login' || !email.value.trim()) {
    if (lockTimer) clearInterval(lockTimer)
    lockTimer = undefined
    lockRemaining.value = 0
    return
  }

  const until = Number(localStorage.getItem(lockStorageKey()))
  if (until > Date.now()) updateLockCountdown(until)
  else localStorage.removeItem(lockStorageKey())
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

watch(email, restoreLoginLock)

onMounted(restoreLoginLock)
onUnmounted(() => {
  if (lockTimer) clearInterval(lockTimer)
})

async function submit() {
  error.value = ''
  message.value = ''
  try {
    if (mode.value === 'forgot') {
      await api.post('/forgot-password', { email: email.value })
      message.value = t('resetSent')
    } else if (mode.value === 'reset') {
      await api.post('/reset-password', {
        email: route.query.email || email.value,
        token: route.query.token,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      })
      message.value = t('passwordReset')
      mode.value = 'login'
      password.value = ''
      passwordConfirmation.value = ''
    } else {
      await auth.login({ email: email.value, password: password.value })
      await router.replace('/')
    }
  } catch (requestError) {
    const retryAfter = Number(requestError.response?.data?.retry_after || requestError.response?.headers?.['retry-after'])
    if (requestError.response?.status === 429 && retryAfter > 0 && mode.value === 'login') {
      const until = Date.now() + retryAfter * 1000
      localStorage.setItem(lockStorageKey(), String(until))
      updateLockCountdown(until)
      error.value = ''
      return
    }
    if (requestError.response?.data?.blocked) {
      error.value = requestError.response.data.message || t('accountBlocked')
      return
    }
    if (requestError.response?.status === 429 && ['forgot', 'reset'].includes(mode.value)) {
      error.value = t('passwordResetRateLimited')
      return
    }
    error.value = Object.values(requestError.response?.data?.errors || {}).flat()[0] || requestError.response?.data?.message || t('errorGeneric')
  }
}

function toggleLanguage() {
  locale.value = locale.value === 'en' ? 'sw' : 'en'
  localStorage.setItem('language', locale.value)
}
</script>

<template>
  <main class="login-shell">
    <button class="language-switch" type="button" @click="toggleLanguage">
      <Languages :size="17" /> {{ t('language') }} · {{ locale === 'en' ? 'EN' : 'SW' }}
    </button>
    <section class="login-card">
      <div class="brand-mark"><BriefcaseBusiness :size="22" /></div>
      <p class="eyebrow">{{ t('brand') }}</p>
      <h1>{{ mode === 'login' ? t('login') : mode === 'forgot' ? t('forgotPassword') : t('resetPassword') }}</h1>
      <p class="muted">{{ mode === 'login' ? t('loginSubtitle') : mode === 'forgot' ? t('forgotSubtitle') : t('resetPassword') }}</p>
      <form class="login-form" @submit.prevent="submit">
        <label for="email">{{ t('email') }}</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="username" :readonly="(mode === 'reset' && Boolean(route.query.email)) || (mode === 'login' && lockRemaining > 0)" :disabled="mode === 'login' && lockRemaining > 0" required />
        <template v-if="mode !== 'forgot'">
          <label for="password">{{ mode === 'reset' ? t('newPassword') : t('password') }}</label>
          <div class="password-field">
            <LockKeyhole :size="17" />
            <input id="password" v-model="password" type="password" :autocomplete="mode === 'reset' ? 'new-password' : 'current-password'" :minlength="mode === 'reset' ? 12 : 1" :disabled="mode === 'login' && lockRemaining > 0" required />
          </div>
        </template>
        <template v-if="mode === 'reset'">
          <label for="password-confirmation">{{ t('confirmPassword') }}</label>
          <input id="password-confirmation" v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" required />
        </template>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="mode === 'login' && lockRemaining > 0" class="form-error" role="alert">{{ t('loginLocked', { time: formatCountdown(lockRemaining) }) }}</p>
        <p v-if="message" class="success-message" role="status">{{ message }}</p>
        <button class="button button-primary full-width" type="submit" :disabled="auth.loading || (mode === 'login' && lockRemaining > 0)">
          {{ auth.loading ? t('signingIn') : mode === 'login' && lockRemaining > 0 ? formatCountdown(lockRemaining) : mode === 'login' ? t('signIn') : mode === 'forgot' ? t('sendResetLink') : t('resetPassword') }}
        </button>
      </form>
      <div v-if="mode === 'login'" class="login-links"><button type="button" @click="mode = 'forgot'; error = ''; message = ''">{{ t('forgotPassword') }}</button></div>
      <div v-else class="login-links"><button type="button" @click="mode = 'login'; error = ''; message = ''">{{ t('backToLogin') }}</button></div>
      <p v-if="mode === 'login'" class="login-footnote">{{ t('noAccount') }}</p>
    </section>
    <p class="login-tagline">{{ t('tagline') }}</p>
  </main>
</template>
