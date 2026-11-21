<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from '@lucide/vue'
import franceFlag from '../assets/france-flag.svg'
import saudiArabiaFlag from '../assets/saudi-arabia-flag.svg'
import tanzaniaFlag from '../assets/tanzania-flag.svg'
import ukFlag from '../assets/uk-flag.svg'

const { locale, t } = useI18n()
const root = ref(null)
const open = ref(false)
const languages = [
  { code: 'en', name: 'English (UK)', flag: ukFlag },
  { code: 'fr', name: 'Français', flag: franceFlag },
  { code: 'ar', name: 'العربية', flag: saudiArabiaFlag },
  { code: 'sw', name: 'Kiswahili (Tanzania)', flag: tanzaniaFlag },
]
const selected = computed(() => languages.find((language) => language.code === locale.value) || languages[0])

function chooseLanguage(language) {
  locale.value = language.code
  open.value = false
}

function closeOnOutsideClick(event) {
  if (!root.value?.contains(event.target)) open.value = false
}

function closeOnEscape(event) {
  if (event.key === 'Escape') open.value = false
}

watch(locale, (value) => {
  localStorage.setItem('language', value)
  document.documentElement.lang = value
  document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr'
}, { immediate: true })

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)
  document.addEventListener('keydown', closeOnEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeOnOutsideClick)
  document.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div ref="root" class="language-picker">
    <button
      class="language-picker-trigger"
      type="button"
      :aria-label="t('selectLanguage')"
      :aria-expanded="open"
      :title="selected.name"
      @click="open = !open"
    >
      <img :src="selected.flag" :alt="selected.name" />
      <ChevronDown :size="12" />
    </button>
    <div v-if="open" class="language-picker-menu" role="menu" :aria-label="t('selectLanguage')">
      <button
        v-for="language in languages"
        :key="language.code"
        class="language-picker-option"
        :class="{ selected: locale === language.code }"
        type="button"
        role="menuitemradio"
        :aria-checked="locale === language.code"
        @click="chooseLanguage(language)"
      >
        <img :src="language.flag" :alt="language.name" />
        <span>{{ language.name }}</span>
      </button>
    </div>
  </div>
</template>
