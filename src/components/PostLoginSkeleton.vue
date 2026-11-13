<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="post-login-skeleton" role="status" :aria-label="t('preparingWorkspace')">
    <aside class="post-login-skeleton-sidebar" aria-hidden="true">
      <div class="skeleton-block skeleton-brand"></div>
      <div class="skeleton-block skeleton-switcher"></div>
      <div class="skeleton-block skeleton-nav skeleton-nav-wide"></div>
      <div class="skeleton-block skeleton-nav"></div>
      <div class="skeleton-block skeleton-nav"></div>
      <div class="skeleton-block skeleton-nav"></div>
      <div class="skeleton-block skeleton-profile"></div>
    </aside>
    <main class="post-login-skeleton-main" aria-hidden="true">
      <header class="post-login-skeleton-topbar">
        <div class="skeleton-block skeleton-crumb"></div>
        <div class="skeleton-block skeleton-user"></div>
      </header>
      <section class="post-login-skeleton-content">
        <div class="post-login-skeleton-heading">
          <div class="skeleton-block skeleton-kicker"></div>
          <div class="skeleton-block skeleton-title"></div>
        </div>
        <div class="post-login-skeleton-metrics">
          <div v-for="item in 4" :key="item" class="post-login-skeleton-metric">
            <div class="skeleton-block skeleton-metric-label"></div>
            <div class="skeleton-block skeleton-metric-value"></div>
            <div class="skeleton-block skeleton-metric-foot"></div>
          </div>
        </div>
        <section class="post-login-skeleton-panel">
          <div class="skeleton-block skeleton-panel-title"></div>
          <div v-for="item in 5" :key="item" class="post-login-skeleton-row">
            <div class="skeleton-block skeleton-row-icon"></div>
            <div class="skeleton-block skeleton-row-copy"></div>
            <div class="skeleton-block skeleton-row-value"></div>
          </div>
        </section>
      </section>
    </main>
    <nav class="post-login-skeleton-mobile-nav" aria-hidden="true">
      <div v-for="item in 5" :key="item">
        <span class="skeleton-block"></span>
        <span class="skeleton-block"></span>
      </div>
    </nav>
  </div>
</template>
