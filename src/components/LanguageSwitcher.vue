<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from '@lucide/vue'
import { languageOptions } from '../constants/languages'

const { locale, t } = useI18n()
const root = ref(null)
const open = ref(false)
const selected = computed(() => languageOptions.find((language) => language.code === locale.value) || languageOptions[0])

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
        v-for="language in languageOptions"
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
