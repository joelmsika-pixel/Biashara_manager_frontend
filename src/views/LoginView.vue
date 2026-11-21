<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { BriefcaseBusiness, Eye, EyeOff, LockKeyhole } from '@lucide/vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const mode = ref(route.name === 'reset-password' ? 'reset' : 'login')
const email = ref(String(route.query.email || ''))
const password = ref('')
const passwordConfirmation = ref('')
const fullName = ref('')
const businessName = ref('')
const phone = ref('')
const currency = ref('TZS')
const error = ref('')
const message = ref('')
const lockRemaining = ref(0)
const showPassword = ref(false)
const rememberMe = ref(localStorage.getItem('remember_login') === 'true')
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
    if (mode.value === 'register') {
      const { data } = await api.post('/register', {
        name: fullName.value,
        business_name: businessName.value,
        phone: phone.value,
        email: email.value,
        currency: currency.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      })
      localStorage.setItem('access_token', data.token)
      localStorage.setItem('refresh_token', data.refresh_token)
      auth.user = data.user
      await router.replace('/')
    } else if (mode.value === 'forgot') {
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
      localStorage.setItem('remember_login', rememberMe.value ? 'true' : 'false')
      await auth.login({ email: email.value, password: password.value })
      auth.startDashboardPreparation()
      await nextTick()
      try {
        await router.replace('/')
      } catch (navigationError) {
        auth.cancelDashboardPreparation()
        throw navigationError
      }
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

</script>

<template>
  <main class="login-shell">
    <LanguageSwitcher />
    <section class="login-card">
      <div class="brand-mark"><BriefcaseBusiness :size="22" /></div>
      <p class="eyebrow">{{ t('brand') }}</p>
      <h1>{{ mode === 'login' ? t('login') : mode === 'register' ? t('createAccount') : mode === 'forgot' ? t('forgotPassword') : t('resetPassword') }}</h1>
      <p class="muted">{{ mode === 'login' ? t('loginSubtitle') : mode === 'register' ? t('registerSubtitle') : mode === 'forgot' ? t('forgotSubtitle') : t('resetPassword') }}</p>
      <form class="login-form" @submit.prevent="submit">
        <template v-if="mode === 'register'">
          <label for="full-name">{{ t('fullName') }}</label>
          <input id="full-name" v-model.trim="fullName" type="text" maxlength="150" required />
          <label for="business-name">{{ t('businessName') }}</label>
          <input id="business-name" v-model.trim="businessName" type="text" maxlength="150" required />
          <label for="phone">{{ t('phone') }}</label>
          <input id="phone" v-model.trim="phone" type="tel" maxlength="30" required />
          <label for="currency">{{ t('currency') }}</label>
          <select id="currency" v-model="currency"><option value="TZS">TZS</option><option value="KES">KES</option><option value="UGX">UGX</option><option value="USD">USD</option></select>
        </template>
        <label for="email">{{ t('email') }}</label>
        <input id="email" v-model.trim="email" type="email" autocomplete="username" :readonly="(mode === 'reset' && Boolean(route.query.email)) || (mode === 'login' && lockRemaining > 0)" :disabled="mode === 'login' && lockRemaining > 0" required />
        <template v-if="mode !== 'forgot'">
          <label for="password">{{ mode === 'reset' ? t('newPassword') : t('password') }}</label>
          <div class="password-field">
            <LockKeyhole :size="17" />
            <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="mode === 'reset' || mode === 'register' ? 'new-password' : 'current-password'" :minlength="mode === 'reset' || mode === 'register' ? 12 : 1" :disabled="mode === 'login' && lockRemaining > 0" required />
            <button v-if="mode !== 'reset'" type="button" class="password-toggle" :aria-label="showPassword ? t('hidePassword') : t('showPassword')" @click="showPassword = !showPassword">
              <component :is="showPassword ? EyeOff : Eye" :size="17" />
            </button>
          </div>
        </template>
        <label v-if="mode === 'login'" class="remember-row"><input v-model="rememberMe" type="checkbox" /><span>{{ t('rememberMe') }}</span></label>
        <template v-if="mode === 'reset' || mode === 'register'">
          <label for="password-confirmation">{{ t('confirmPassword') }}</label>
          <input id="password-confirmation" v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" required />
        </template>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <p v-if="mode === 'login' && lockRemaining > 0" class="form-error" role="alert">{{ t('loginLocked', { time: formatCountdown(lockRemaining) }) }}</p>
        <p v-if="message" class="success-message" role="status">{{ message }}</p>
        <button class="button button-primary full-width" type="submit" :disabled="auth.loading || (mode === 'login' && lockRemaining > 0)">
          {{ auth.loading ? t('signingIn') : mode === 'login' && lockRemaining > 0 ? formatCountdown(lockRemaining) : mode === 'register' ? t('createAccount') : mode === 'login' ? t('signIn') : mode === 'forgot' ? t('sendResetLink') : t('resetPassword') }}
        </button>
      </form>
      <div v-if="mode === 'login'" class="login-links"><button type="button" @click="mode = 'forgot'; error = ''; message = ''">{{ t('forgotPassword') }}</button><button type="button" @click="mode = 'register'; error = ''; message = ''">{{ t('createAccount') }}</button></div>
      <div v-else class="login-links"><button type="button" @click="mode = 'login'; error = ''; message = ''">{{ t('backToLogin') }}</button></div>
      <p v-if="mode === 'login'" class="login-footnote">{{ t('noAccount') }}</p>
    </section>
    <p class="login-tagline">{{ t('tagline') }}</p>
  </main>
</template>
