import { defineStore } from 'pinia'
import { ref } from 'vue'

const defaultDuration = 4500

export const useToastStore = defineStore('toast', () => {
  const current = ref(null)
  let timer
  let nextId = 0

  function show(message, type = 'success', duration = defaultDuration) {
    dismiss()
    const id = ++nextId
    current.value = { id, message, type, duration }
    timer = setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id) {
    if (!current.value || (id !== undefined && current.value.id !== id)) return
    clearTimeout(timer)
    timer = undefined
    current.value = null
  }

  return { current, show, dismiss }
})
