<script setup>
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAuthStore } from './stores/auth'
import PostLoginSkeleton from './components/PostLoginSkeleton.vue'
import ToastHost from './components/ToastHost.vue'

const auth = useAuthStore()
onMounted(() => auth.initialize())
</script>

<template>
  <div class="app-root">
    <RouterView />
    <PostLoginSkeleton v-if="auth.loading || auth.postLoginLoading" />
    <ToastHost />
  </div>
</template>
