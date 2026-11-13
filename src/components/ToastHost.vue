<script setup>
import { useI18n } from 'vue-i18n'
import { CheckCircle2, TriangleAlert, X } from '@lucide/vue'
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
const { t } = useI18n()
</script>

<template>
  <div class="toast-host">
    <Transition name="toast">
      <div
        v-if="toast.current"
        :key="toast.current.id"
        class="toast-message"
        :class="`toast-${toast.current.type}`"
        :style="{ '--toast-duration': `${toast.current.duration}ms` }"
        :role="toast.current.type === 'error' ? 'alert' : 'status'"
        :aria-live="toast.current.type === 'error' ? 'assertive' : 'polite'"
      >
        <span class="toast-icon" aria-hidden="true">
          <TriangleAlert v-if="toast.current.type === 'error'" :size="19" />
          <CheckCircle2 v-else :size="19" />
        </span>
        <p>{{ toast.current.message }}</p>
        <button
          class="toast-dismiss"
          type="button"
          :aria-label="t('dismissNotification')"
          @click="toast.dismiss(toast.current.id)"
        >
          <X :size="17" />
        </button>
        <span class="toast-progress" aria-hidden="true"></span>
      </div>
    </Transition>
  </div>
</template>
