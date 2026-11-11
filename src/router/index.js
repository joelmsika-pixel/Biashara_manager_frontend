import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue') },
    { path: '/reset-password', name: 'reset-password', component: () => import('../views/LoginView.vue') },
    { path: '/admin', name: 'admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
    { path: '/', name: 'home', component: () => import('../views/WorkspaceView.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initialize()
  if (to.meta.requiresAuth && !auth.user) return { name: 'login' }
  if (to.meta.requiresAdmin && !auth.user?.is_platform_admin) return { name: 'home' }
  if (to.name === 'login' && auth.user) return { name: auth.user.is_platform_admin ? 'admin' : 'home' }
  if (to.name === 'home' && auth.user?.is_platform_admin) return { name: 'admin' }
  return true
})

export { router }
