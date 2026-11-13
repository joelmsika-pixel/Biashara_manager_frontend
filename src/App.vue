<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import ToastHost from './components/ToastHost.vue'

const auth = useAuthStore()
onMounted(() => auth.initialize())
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
