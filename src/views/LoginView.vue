<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, BriefcaseBusiness, Eye, EyeOff, LockKeyhole } from '@lucide/vue'
import { useAuthStore } from '../stores/auth'
import api from '../services/api'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import { languageOptions } from '../constants/languages'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { locale, t } = useI18n()
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
const rememberCheckboxAnimating = ref(false)
const loginFieldsVisible = ref(false)
const loginRevealAnimating = ref(false)
const languageSelectionVisible = ref(false)
const promoSlideIndex = ref(0)
const webAppVersion = __WEB_APP_VERSION__
const webAppBuildVersion = __WEB_APP_BUILD_VERSION__
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const mobilePromoQuery = window.matchMedia('(max-width: 720px)')
const promoPaused = ref(prefersReducedMotion || mobilePromoQuery.matches)
const promoSlides = computed(() => [
  {
    title: t('loginPromoControl'),
    image: '/images/login-business-control.webp',
    alt: t('loginPromoWelcomeAlt'),
  },
  {
    title: t('loginPromoGrowth'),
    image: '/images/login-business-growth.webp',
    alt: t('loginPromoGrowthAlt'),
  },
  {
    title: t('loginPromoProfit'),
    image: '/images/login-business-profit.webp',
    alt: t('loginPromoProfitAlt'),
  },
])
let lockTimer
let promoTimer
let promoPointerStart
let rememberCheckboxAnimationFrame
let rememberCheckboxAnimationTimer

function animateRememberCheckbox() {
  if (prefersReducedMotion) return
  rememberCheckboxAnimating.value = false
  if (rememberCheckboxAnimationFrame) cancelAnimationFrame(rememberCheckboxAnimationFrame)
  if (rememberCheckboxAnimationTimer) clearTimeout(rememberCheckboxAnimationTimer)
  rememberCheckboxAnimationFrame = requestAnimationFrame(() => {
    rememberCheckboxAnimating.value = true
    rememberCheckboxAnimationFrame = undefined
    rememberCheckboxAnimationTimer = window.setTimeout(() => {
      rememberCheckboxAnimating.value = false
      rememberCheckboxAnimationTimer = undefined
    }, 400)
  })
}

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

function revealLoginFields() {
  if (loginRevealAnimating.value) return
  if (prefersReducedMotion) {
    showLoginFields()
    return
  }
  loginRevealAnimating.value = true
}

function startMobileOnboarding() {
  promoSlideIndex.value = 1
  languageSelectionVisible.value = true
  nextTick(() => document.querySelector('.login-language-option')?.focus())
}

function closeLanguageSelection() {
  languageSelectionVisible.value = false
  promoSlideIndex.value = 0
  nextTick(() => document.querySelector('.login-reveal-button-mobile')?.focus())
}

function chooseOnboardingLanguage(language) {
  locale.value = language.code
  promoSlideIndex.value = 2
  languageSelectionVisible.value = false
  loginFieldsVisible.value = true
  nextTick(() => document.getElementById('email')?.focus())
}

function finishLoginReveal(event) {
  if (!['login-reveal-overflow', 'login-reveal-overflow-desktop'].includes(event.animationName)) return
  loginRevealAnimating.value = false
  showLoginFields()
}

function showLoginFields() {
  loginFieldsVisible.value = true
  nextTick(() => document.getElementById('email')?.focus())
}

function advancePromoSlide() {
  promoSlideIndex.value = (promoSlideIndex.value + 1) % promoSlides.value.length
}

function handlePromoPointerStart(event) {
  if (!mobilePromoQuery.matches || (event.pointerType === 'mouse' && event.button !== 0)) return
  promoPointerStart = { x: event.clientX, y: event.clientY }
}

function handlePromoPointerEnd(event) {
  if (!promoPointerStart) return
  const deltaX = promoPointerStart.x - event.clientX
  const deltaY = promoPointerStart.y - event.clientY
  promoPointerStart = undefined
  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY)) return

  if (deltaX > 0 && promoSlideIndex.value === 0) {
    promoSlideIndex.value = 1
    languageSelectionVisible.value = true
    nextTick(() => document.querySelector('.login-language-option')?.focus())
  } else if (deltaX < 0 && promoSlideIndex.value === 1) {
    closeLanguageSelection()
  } else if (deltaX < 0 && promoSlideIndex.value > 1) {
    promoSlideIndex.value -= 1
  }
}

function handlePromoViewportChange() {
  promoPaused.value = prefersReducedMotion || mobilePromoQuery.matches
  startPromoTimer()
}

function startPromoTimer() {
  if (promoTimer) clearInterval(promoTimer)
  promoTimer = undefined
  if (!promoPaused.value && !mobilePromoQuery.matches) promoTimer = setInterval(advancePromoSlide, 6500)
}

function pausePromo() {
  promoPaused.value = true
  startPromoTimer()
}

function resumePromo() {
  if (prefersReducedMotion) return
  if (document.activeElement?.closest('.login-layout')) return
  promoPaused.value = false
  startPromoTimer()
}

function handlePromoFocusOut(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) resumePromo()
}

watch(email, restoreLoginLock)

onMounted(() => {
  document.documentElement.classList.add('login-page-fixed')
  document.body.classList.add('login-page-fixed')
  mobilePromoQuery.addEventListener('change', handlePromoViewportChange)
  restoreLoginLock()
  startPromoTimer()
})
onUnmounted(() => {
  document.documentElement.classList.remove('login-page-fixed')
  document.body.classList.remove('login-page-fixed')
  mobilePromoQuery.removeEventListener('change', handlePromoViewportChange)
  if (lockTimer) clearInterval(lockTimer)
  if (promoTimer) clearInterval(promoTimer)
  if (rememberCheckboxAnimationFrame) cancelAnimationFrame(rememberCheckboxAnimationFrame)
  if (rememberCheckboxAnimationTimer) clearTimeout(rememberCheckboxAnimationTimer)
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
  <main class="login-shell" :class="{ 'login-shell-prompt': mode === 'login' && !loginFieldsVisible, 'login-shell-expanded': mode === 'login' && loginFieldsVisible, 'login-shell-forgot': mode === 'forgot', 'login-shell-language': languageSelectionVisible }" @pointerdown="handlePromoPointerStart" @pointerup="handlePromoPointerEnd" @pointercancel="promoPointerStart = undefined">
    <LanguageSwitcher />
    <div class="login-layout" @mouseenter="pausePromo" @mouseleave="resumePromo" @focusin="pausePromo" @focusout="handlePromoFocusOut">
      <section class="login-intro" :aria-label="t('brand')">
        <div class="login-brand">
          <div class="brand-mark"><BriefcaseBusiness :size="22" /></div>
          <p class="eyebrow">{{ t('brand') }}</p>
        </div>
        <p class="login-brand-tagline">{{ t('tagline') }}</p>
        <section class="login-promo" role="region" :aria-label="t('loginPromoLabel')">
          <Transition name="login-promo" mode="out-in">
            <div :key="promoSlideIndex" class="login-promo-slide">
              <picture>
                <source
                  v-if="promoSlideIndex === 0"
                  media="(max-width: 720px)"
                  srcset="/images/Confident%20Welcome%20in%20the%20Modern%20Office.webp"
                />
                <source
                  v-else-if="promoSlideIndex === 1"
                  media="(max-width: 720px)"
                  srcset="/images/Smiling%20Professional%20at%20the%20Office%20Desk.webp"
                />
                <source
                  v-else-if="promoSlideIndex === 2"
                  media="(max-width: 720px)"
                  srcset="/images/Triumphant%20Professional%20at%20Modern%20Entrance.webp"
                />
                <img
                  class="login-promo-image"
                  :src="promoSlides[promoSlideIndex].image"
                  :fetchpriority="promoSlideIndex === 0 ? 'high' : 'auto'"
                  :alt="promoSlides[promoSlideIndex].alt"
                />
              </picture>
              <h2 class="login-promo-title">{{ promoSlides[promoSlideIndex].title }}</h2>
            </div>
          </Transition>
        </section>
      </section>
      <section class="login-card" :class="{ 'login-card-login': mode === 'login', 'login-card-expanded': mode === 'login' && loginFieldsVisible, 'login-card-forgot': mode === 'forgot' }">
        <header class="login-heading">
          <h1>{{ mode === 'login' ? t('login') : mode === 'register' ? t('createAccount') : mode === 'forgot' ? t('forgotPassword') : t('resetPassword') }}</h1>
          <p class="muted">{{ mode === 'login' ? t('loginSubtitle') : mode === 'register' ? t('registerSubtitle') : mode === 'forgot' ? t('forgotSubtitle') : t('resetPassword') }}</p>
        </header>
        <form class="login-form" @submit.prevent="submit">
          <button v-if="mode === 'login' && !loginFieldsVisible" class="login-reveal-button login-reveal-button-desktop" :class="{ 'login-reveal-button-animating': loginRevealAnimating }" type="button" @click="revealLoginFields" @animationend="finishLoginReveal">{{ t('loginButton') }}</button>
          <button v-if="mode === 'login' && !loginFieldsVisible" class="login-reveal-button login-reveal-button-mobile" type="button" @click="startMobileOnboarding">
            {{ t('getStarted') }} <ArrowRight :size="18" aria-hidden="true" />
          </button>
          <template v-else>
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
            <div v-if="mode === 'login'" class="login-remember-actions">
              <label class="remember-row"><input v-model="rememberMe" :class="{ 'remember-checkbox-animating': rememberCheckboxAnimating }" type="checkbox" @change="animateRememberCheckbox" /><span>{{ t('rememberMe') }}</span></label>
              <button type="button" class="login-forgot-link" @click="mode = 'forgot'; error = ''; message = ''">{{ t('forgotPassword') }}</button>
            </div>
            <template v-if="mode === 'reset' || mode === 'register'">
              <label for="password-confirmation">{{ t('confirmPassword') }}</label>
              <input id="password-confirmation" v-model="passwordConfirmation" type="password" autocomplete="new-password" minlength="12" required />
            </template>
            <p v-if="error" class="form-error" role="alert">{{ error }}</p>
            <p v-if="mode === 'login' && lockRemaining > 0" class="form-error" role="alert">{{ t('loginLocked', { time: formatCountdown(lockRemaining) }) }}</p>
            <p v-if="message" class="success-message" role="status">{{ message }}</p>
            <button class="button button-primary full-width" type="submit" :disabled="auth.loading || (mode === 'login' && lockRemaining > 0)">
              {{ auth.loading ? t('signingIn') : mode === 'login' && lockRemaining > 0 ? formatCountdown(lockRemaining) : mode === 'register' ? t('createAccount') : mode === 'login' ? t('loginButton') : mode === 'forgot' ? t('sendResetLink') : t('resetPassword') }}
            </button>
          </template>
        </form>
        <div v-if="mode !== 'login'" class="login-links"><button type="button" @click="mode = 'login'; error = ''; message = ''">{{ t('backToLogin') }}</button></div>
        <p v-if="mode === 'login'" class="login-footnote">{{ t('noAccount') }}</p>
        <div v-if="mode === 'forgot' || (mode === 'login' && loginFieldsVisible)" class="login-app-footer">
          <p class="login-developer-credit"><span>{{ t('developedBy') }}</span><img src="/images/Asset%2018.png" alt="Godob" /></p>
          <p class="login-build-info">{{ t('appBuildInfo', { version: webAppVersion, build: webAppBuildVersion }) }}</p>
        </div>
      </section>
    </div>
    <Transition name="login-language">
      <div
        v-if="languageSelectionVisible"
        class="login-language-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('selectLanguage')"
        @click.self="closeLanguageSelection"
        @keydown.esc="closeLanguageSelection"
      >
        <section class="login-language-card">
          <h2>{{ t('selectLanguage') }}</h2>
          <div class="login-language-options">
            <button
              v-for="language in languageOptions"
              :key="language.code"
              class="login-language-option"
              type="button"
              @click="chooseOnboardingLanguage(language)"
            >
              <img :src="language.flag" :alt="language.name" />
              <span>{{ language.name }}</span>
              <ArrowRight :size="17" aria-hidden="true" />
            </button>
          </div>
          <button class="login-language-cancel" type="button" @click="closeLanguageSelection">{{ t('cancel') }}</button>
        </section>
      </div>
    </Transition>
  </main>
</template>
