import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import './style.css'
import App from './App.vue'
import { router } from './router'
import en from './locales/en.json'
import sw from './locales/sw.json'

const staleChunkReloadKey = 'bizikua:stale-chunk-reload'
window.addEventListener('vite:preloadError', (event) => {
  const now = Date.now()
  const lastReload = Number(sessionStorage.getItem(staleChunkReloadKey) || 0)
  if (now - lastReload < 30_000) return

  event.preventDefault()
  sessionStorage.setItem(staleChunkReloadKey, String(now))
  window.location.reload()
})

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('language') || 'en',
  fallbackLocale: 'en',
  messages: { en, sw },
})

createApp(App).use(createPinia()).use(router).use(i18n).mount('#app')
