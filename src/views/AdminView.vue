<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, LogOut, Plus, RefreshCw, Shield, Trash2 } from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import ukFlag from '../assets/uk-flag.svg'
import tanzaniaFlag from '../assets/tanzania-flag.svg'

const auth = useAuthStore()
const router = useRouter()
const { t, locale } = useI18n()
const businesses = ref([])
const loading = ref(false)
const saving = ref(false)
const includeDeleted = ref(false)
const error = ref('')
const formOpen = ref(false)
const formError = ref('')
const form = ref({})
const confirmRemoval = ref(null)
const confirmError = ref('')
const removing = ref(false)
const confirmDialog = ref(null)
const removalTrigger = ref(null)
const activeCount = computed(() => businesses.value.filter((item) => !item.deleted_at && item.status === 'active').length)
const inactiveCount = computed(() => businesses.value.length - activeCount.value)

function businessInitials(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function switchLanguage() {
  locale.value = locale.value === 'en' ? 'sw' : 'en'
  localStorage.setItem('language', locale.value)
}

async function loadBusinesses() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/businesses', { params: { per_page: 100, include_deleted: includeDeleted.value } })
    businesses.value = data.data || []
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('businessLoadFailed')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  formError.value = ''
  form.value = { currency: 'TZS' }
  formOpen.value = true
}

async function createBusiness() {
  saving.value = true
  formError.value = ''
  try {
    await api.post('/admin/businesses', form.value)
    formOpen.value = false
    await loadBusinesses()
  } catch (requestError) {
    formError.value = requestError.response?.data?.message
      || Object.values(requestError.response?.data?.errors || {}).flat()[0]
      || t('businessCreateFailed')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(item) {
  error.value = ''
  try {
    const status = item.status === 'active' ? 'suspended' : 'active'
    await api.patch(`/admin/businesses/${item.id}/status`, { status })
    item.status = status
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('businessStatusFailed')
  }
}

function removeBusiness(item) {
  removalTrigger.value = document.activeElement
  confirmError.value = ''
  confirmRemoval.value = item
  nextTick(() => confirmDialog.value?.focus())
}

function closeRemovalConfirmation() {
  if (removing.value) return
  confirmRemoval.value = null
  confirmError.value = ''
  nextTick(() => removalTrigger.value?.focus())
}

async function confirmRemoveBusiness() {
  if (!confirmRemoval.value) return
  removing.value = true
  confirmError.value = ''
  try {
    await api.delete(`/admin/businesses/${confirmRemoval.value.id}`)
    confirmRemoval.value = null
    removalTrigger.value = null
    await loadBusinesses()
  } catch (requestError) {
    confirmError.value = requestError.response?.data?.message || t('businessRemoveFailed')
  } finally {
    removing.value = false
  }
}

async function restoreBusiness(item) {
  error.value = ''
  try {
    await api.post(`/admin/businesses/${item.id}/restore`)
    await loadBusinesses()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('businessRestoreFailed')
  }
}

async function logout() {
  try {
    await auth.logout()
  } finally {
    await router.push({ name: 'login' })
  }
}

onMounted(loadBusinesses)
</script>

<template>
  <main class="content admin-page">
    <header class="admin-page-heading">
      <div class="admin-heading-copy">
        <div class="admin-heading-overline">
          <p class="eyebrow"><Shield :size="14" /> {{ t('platformAdministration') }}</p>
          <button
            class="language-button admin-language-button"
            type="button"
            :aria-label="`${t('language')}: ${locale === 'en' ? t('english') : t('swahili')}`"
            :title="locale === 'en' ? t('english') : t('swahili')"
            @click="switchLanguage"
          >
            <img class="language-flag" :src="locale === 'en' ? ukFlag : tanzaniaFlag" alt="" />
          </button>
        </div>
        <h1>{{ t('businesses') }}</h1>
        <p class="page-subtitle">{{ t('adminBusinessSubtitle') }}</p>
      </div>
      <div class="admin-page-actions">
        <button class="button button-secondary" type="button" @click="includeDeleted = !includeDeleted; loadBusinesses()">
          {{ includeDeleted ? t('hideRemoved') : t('showRemoved') }}
        </button>
        <button class="button button-secondary" type="button" :disabled="loading" @click="loadBusinesses">
          <RefreshCw :size="16" :class="{ 'admin-refreshing': loading }" /> {{ t('refresh') }}
        </button>
        <button class="button button-primary" type="button" @click="openCreate"><Plus :size="16" /> {{ t('createBusiness') }}</button>
        <button class="button button-secondary admin-sign-out" type="button" @click="logout"><LogOut :size="16" /> {{ t('logout') }}</button>
      </div>
    </header>

    <div v-if="error" class="notice-banner" role="alert">{{ error }}</div>
    <section class="admin-summary" :aria-label="t('businessSummary')">
      <article class="admin-summary-card">
        <span class="admin-summary-icon"><BriefcaseBusiness :size="18" /></span>
        <div><span>{{ t('businessesListed') }}</span><strong>{{ businesses.length }}</strong></div>
      </article>
      <article class="admin-summary-card admin-summary-active">
        <span class="admin-summary-icon"><Shield :size="18" /></span>
        <div><span>{{ t('active') }}</span><strong>{{ activeCount }}</strong></div>
      </article>
      <article class="admin-summary-card admin-summary-inactive">
        <span class="admin-summary-icon"><RefreshCw :size="18" /></span>
        <div><span>{{ t('suspendedOrRemoved') }}</span><strong>{{ inactiveCount }}</strong></div>
      </article>
    </section>

    <section class="panel-card admin-business-panel">
      <div class="admin-panel-heading">
        <div class="admin-panel-title">
          <span class="admin-panel-icon"><BriefcaseBusiness :size="18" /></span>
          <div>
            <h2>{{ t('allBusinesses') }}</h2>
            <p>{{ t('adminBusinessPanelSubtitle') }}</p>
          </div>
        </div>
        <span class="admin-list-count">{{ businesses.length }} <span>{{ t('listed') }}</span></span>
      </div>
      <div v-if="loading && !businesses.length" class="admin-grid-state" role="status">
        <span class="admin-loader"></span>{{ t('loadingBusinesses') }}
      </div>
      <div v-else-if="!loading && !businesses.length" class="admin-grid-state">
        {{ t('noBusinesses') }}
      </div>
      <div v-else class="admin-business-grid">
        <div v-if="loading" class="admin-refresh-note" role="status"><span class="admin-loader"></span>{{ t('updatingBusinessList') }}</div>
        <article v-for="item in businesses" :key="item.id" class="admin-business-card">
          <div class="admin-business-card-top">
            <span class="admin-status" :class="item.deleted_at ? 'admin-status-removed' : `admin-status-${item.status}`">
              <span></span>{{ item.deleted_at ? t('removed') : t(item.status) }}
            </span>
          </div>
          <div class="admin-business-card-title">
            <span class="admin-business-avatar">{{ businessInitials(item.name) }}</span>
            <span class="admin-business-title-copy">
              <span>{{ item.business_type || t('businessAccount') }}</span>
              <h3>{{ item.name }}</h3>
            </span>
          </div>
          <div class="admin-business-card-owner">
            <span class="admin-card-label">{{ t('accountOwner') }}</span>
            <div class="admin-owner-entry">
              <span class="admin-owner-avatar">{{ businessInitials(item.users?.[0]?.name || '?') }}</span>
              <span class="admin-owner-copy">
                <strong>{{ item.users?.[0]?.name || t('noOwnerAssigned') }}</strong>
                <small>{{ item.users?.[0]?.email || t('ownerDetailsUnavailable') }}</small>
              </span>
            </div>
          </div>
          <div class="admin-business-card-facts">
            <span>{{ t('reportingCurrency') }}</span>
            <strong>{{ item.currency }}</strong>
          </div>
          <div class="admin-row-actions">
            <button v-if="item.deleted_at" class="admin-action admin-action-restore" type="button" @click="restoreBusiness(item)">{{ t('restoreBusiness') }}</button>
            <template v-else>
              <button class="admin-action admin-action-status" type="button" @click="toggleStatus(item)">{{ item.status === 'active' ? t('suspendBusiness') : t('activateBusiness') }}</button>
              <button class="admin-action admin-action-remove" type="button" @click="removeBusiness(item)">{{ t('removeBusiness') }}</button>
            </template>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="confirmRemoval"
      class="modal-backdrop"
      tabindex="-1"
      @click.self="closeRemovalConfirmation"
      @keydown.esc="closeRemovalConfirmation"
    >
      <section ref="confirmDialog" class="modal-card admin-confirm-card" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" tabindex="-1">
        <div class="admin-confirm-heading">
          <span class="admin-confirm-icon"><Trash2 :size="20" /></span>
          <div>
            <p class="eyebrow">{{ t('destructiveAction') }}</p>
            <h2 id="admin-confirm-title">{{ t('removeBusinessTitle') }}</h2>
          </div>
        </div>
        <p class="admin-confirm-message">
          {{ t('removeBusinessConfirmation', { name: confirmRemoval.name }) }}
        </p>
        <p v-if="confirmError" class="form-error admin-confirm-error" role="alert">{{ confirmError }}</p>
        <div class="admin-confirm-actions">
          <button class="button button-secondary" type="button" :disabled="removing" @click="closeRemovalConfirmation">{{ t('cancel') }}</button>
          <button class="button admin-confirm-danger" type="button" :disabled="removing" @click="confirmRemoveBusiness">
            {{ removing ? t('removingBusiness') : t('confirmRemoveBusiness') }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="formOpen" class="modal-backdrop" @click.self="formOpen = false">
      <form class="modal-card" @submit.prevent="createBusiness">
        <div class="panel-heading"><h2>{{ t('createBusiness') }}</h2><button class="icon-button" type="button" :aria-label="t('cancel')" @click="formOpen = false">×</button></div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="form-grid">
          <label>{{ t('businessName') }}<input v-model="form.name" required maxlength="150"></label>
          <label>{{ t('businessType') }}<input v-model="form.business_type" maxlength="100"></label>
          <label>{{ t('businessPhone') }}<input v-model="form.phone" maxlength="30"></label>
          <label>{{ t('businessEmail') }}<input v-model="form.email" type="email" maxlength="150"></label>
          <label>{{ t('address') }}<input v-model="form.address" maxlength="1000"></label>
          <label>{{ t('currency') }}<select v-model="form.currency"><option>TZS</option><option>KES</option><option>UGX</option><option>USD</option></select></label>
          <label>{{ t('ownerName') }}<input v-model="form.owner_name" required maxlength="150"></label>
          <label>{{ t('ownerEmail') }}<input v-model="form.owner_email" required type="email" maxlength="150"></label>
          <label>{{ t('ownerPhone') }}<input v-model="form.owner_phone" maxlength="30"></label>
          <label>{{ t('ownerPassword') }}<input v-model="form.owner_password" type="password" minlength="12" autocomplete="new-password"></label>
        </div>
        <p class="page-subtitle">{{ t('ownerCredentialsHint') }}</p>
        <div class="heading-actions">
          <button class="button button-secondary" type="button" @click="formOpen = false">{{ t('cancel') }}</button>
          <button class="button button-primary" type="submit" :disabled="saving">{{ saving ? t('creatingBusiness') : t('createBusiness') }}</button>
        </div>
      </form>
    </div>

    <nav class="admin-mobile-nav" :aria-label="t('adminMobileNavigation')">
      <span class="admin-mobile-nav-item admin-mobile-nav-current" aria-current="page">
        <BriefcaseBusiness :size="18" />
        <span>{{ t('businesses') }}</span>
      </span>
      <button class="admin-mobile-nav-item" type="button" @click="openCreate">
        <Plus :size="18" />
        <span>{{ t('createBusiness') }}</span>
      </button>
      <button class="admin-mobile-nav-item" type="button" :disabled="loading" @click="loadBusinesses">
        <RefreshCw :size="18" :class="{ 'admin-refreshing': loading }" />
        <span>{{ t('refresh') }}</span>
      </button>
      <button
        class="admin-mobile-nav-item"
        :class="{ 'admin-mobile-nav-selected': includeDeleted }"
        type="button"
        :aria-label="includeDeleted ? t('hideRemoved') : t('showRemoved')"
        :aria-pressed="includeDeleted"
        @click="includeDeleted = !includeDeleted; loadBusinesses()"
      >
        <Trash2 :size="18" />
        <span>{{ t('removed') }}</span>
      </button>
      <button class="admin-mobile-nav-item" type="button" @click="logout">
        <LogOut :size="18" />
        <span>{{ t('logout') }}</span>
      </button>
    </nav>
  </main>
</template>
