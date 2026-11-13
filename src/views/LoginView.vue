<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, LockKeyhole, UserRound } from '@lucide/vue'
import { useAuthStore } from '../stores/auth'
import { useToastStore } from '../stores/toast'
import api from '../services/api'
import bizikuaLogo from '../assets/Bizikua Business Manager Logo.png'
import ukFlag from '../assets/uk-flag.svg'
import tanzaniaFlag from '../assets/tanzania-flag.svg'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()
const toast = useToastStore()
const mode = ref(route.name === 'reset-password' ? 'reset' : 'login')
const email = ref(String(route.query.email || ''))
const password = ref('')
const passwordConfirmation = ref('')
const showPassword = ref(false)
const showPasswordConfirmation = ref(false)
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
  toast.dismiss()
  try {
    if (mode.value === 'forgot') {
      await api.post('/forgot-password', { email: email.value })
      toast.show(t('resetSent'))
    } else if (mode.value === 'reset') {
      await api.post('/reset-password', {
        email: route.query.email || email.value,
        token: route.query.token,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      })
      toast.show(t('passwordReset'))
      mode.value = 'login'
      password.value = ''
      passwordConfirmation.value = ''
    } else {
      await auth.login({ email: email.value, password: password.value })
      toast.show(t('loginSuccess'))
      await router.replace('/')
    }
  } catch (requestError) {
    const retryAfter = Number(requestError.response?.data?.retry_after || requestError.response?.headers?.['retry-after'])
    if (requestError.response?.status === 429 && retryAfter > 0 && mode.value === 'login') {
      const until = Date.now() + retryAfter * 1000
      localStorage.setItem(lockStorageKey(), String(until))
      updateLockCountdown(until)
      return
    }
    if (requestError.response?.data?.blocked) {
      toast.show(requestError.response.data.message || t('accountBlocked'), 'error')
      return
    }
    if (requestError.response?.status === 429 && ['forgot', 'reset'].includes(mode.value)) {
      toast.show(t('passwordResetRateLimited'), 'error')
      return
    }
    toast.show(Object.values(requestError.response?.data?.errors || {}).flat()[0] || requestError.response?.data?.message || t('errorGeneric'), 'error')
  }
}

function toggleLanguage() {
  locale.value = locale.value === 'en' ? 'sw' : 'en'
  localStorage.setItem('language', locale.value)
}
</script>

<template>
  <main class="login-shell">
    <button
      class="language-switch"
      type="button"
      :aria-label="`${t('language')}: ${locale === 'en' ? t('english') : t('swahili')}`"
      :title="locale === 'en' ? t('english') : t('swahili')"
      @click="toggleLanguage"
    >
      <img class="language-flag" :src="locale === 'en' ? ukFlag : tanzaniaFlag" alt="" />
    </button>
    <section class="login-card">
      <aside class="login-showcase">
        <div class="login-showcase-brand">
          <img class="login-brand-logo" :src="bizikuaLogo" alt="Bizikua Business Manager" />
        </div>
        <div class="login-showcase-art" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p class="login-tagline">{{ t('tagline') }}</p>
      </aside>
      <div class="login-content">
        <h1>{{ mode === 'login' ? t('login') : mode === 'forgot' ? t('forgotPassword') : t('resetPassword') }}</h1>
        <p class="muted">{{ mode === 'login' ? t('loginSubtitle') : mode === 'forgot' ? t('forgotSubtitle') : t('resetPassword') }}</p>
        <form class="login-form" @submit.prevent="submit">
          <label for="email">{{ t('email') }}</label>
          <div class="input-with-icon">
            <UserRound :size="17" />
            <input id="email" v-model.trim="email" type="email" autocomplete="username" placeholder="Godob Company" :readonly="(mode === 'reset' && Boolean(route.query.email)) || (mode === 'login' && lockRemaining > 0)" :disabled="mode === 'login' && lockRemaining > 0" required />
          </div>
          <template v-if="mode !== 'forgot'">
            <label for="password">{{ mode === 'reset' ? t('newPassword') : t('password') }}</label>
            <div class="input-with-icon password-input">
              <LockKeyhole :size="17" />
              <input id="password" v-model="password" :type="showPassword ? 'text' : 'password'" :autocomplete="mode === 'reset' ? 'new-password' : 'current-password'" placeholder="2023" :minlength="mode === 'reset' ? 12 : 1" :disabled="mode === 'login' && lockRemaining > 0" required />
              <button
                class="password-toggle"
                type="button"
                :aria-label="showPassword ? t('hidePassword') : t('showPassword')"
                :aria-pressed="showPassword"
                :disabled="mode === 'login' && lockRemaining > 0"
                @click="showPassword = !showPassword"
              >
                <EyeOff v-if="showPassword" :size="17" />
                <Eye v-else :size="17" />
              </button>
            </div>
          </template>
          <template v-if="mode === 'reset'">
            <label for="password-confirmation">{{ t('confirmPassword') }}</label>
            <div class="input-with-icon password-input">
              <LockKeyhole :size="17" />
              <input id="password-confirmation" v-model="passwordConfirmation" :type="showPasswordConfirmation ? 'text' : 'password'" autocomplete="new-password" placeholder="2023" minlength="12" required />
              <button
                class="password-toggle"
                type="button"
                :aria-label="showPasswordConfirmation ? t('hidePassword') : t('showPassword')"
                :aria-pressed="showPasswordConfirmation"
                @click="showPasswordConfirmation = !showPasswordConfirmation"
              >
                <EyeOff v-if="showPasswordConfirmation" :size="17" />
                <Eye v-else :size="17" />
              </button>
            </div>
          </template>
          <p v-if="error" class="form-error" role="alert">{{ error }}</p>
          <p v-if="mode === 'login' && lockRemaining > 0" class="form-error" role="alert">{{ t('loginLocked', { time: formatCountdown(lockRemaining) }) }}</p>
          <p v-if="message" class="success-message" role="status">{{ message }}</p>
          <button class="button button-primary full-width" type="submit" :disabled="auth.loading || (mode === 'login' && lockRemaining > 0)">
            {{ auth.loading ? t('signingIn') : mode === 'login' && lockRemaining > 0 ? formatCountdown(lockRemaining) : mode === 'login' ? t('signIn') : mode === 'forgot' ? t('sendResetLink') : t('resetPassword') }}
          </button>
        </form>
        <div v-if="mode === 'login'" class="login-links"><button type="button" @click="mode = 'forgot'; toast.dismiss()">{{ t('forgotPassword') }}</button></div>
        <div v-else class="login-links"><button type="button" @click="mode = 'login'; toast.dismiss()">{{ t('backToLogin') }}</button></div>
        <p v-if="mode === 'login'" class="login-footnote">{{ t('noAccount') }}</p>
      </div>
    </section>
  </main>
</template>
