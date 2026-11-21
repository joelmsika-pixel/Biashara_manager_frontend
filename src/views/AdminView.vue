<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  AlertTriangle, Archive, Building2, BriefcaseBusiness, CircleCheck, CirclePause, LogOut, Moon, Plus,
  RefreshCw, Search, Shield, Sun, Trash2, UserRound, X,
} from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const auth = useAuthStore()
const router = useRouter()
const { t } = useI18n()
const darkTheme = ref(localStorage.getItem('admin_theme') === 'dark')
const businesses = ref([])
const search = ref('')
const page = ref(1)
const pagination = ref(null)
const loading = ref(false)
const saving = ref(false)
const includeDeleted = ref(false)
const error = ref('')
const notice = ref('')
const formOpen = ref(false)
const formError = ref('')
const form = ref({})
const removeBusinessTarget = ref(null)
const removeBusinessData = ref(false)
let businessLoadRequestId = 0
const activeOnPage = computed(() => businesses.value.filter((item) => !item.deleted_at && item.status === 'active').length)
const suspendedOnPage = computed(() => businesses.value.filter((item) => !item.deleted_at && item.status !== 'active').length)

watch(darkTheme, (enabled) => {
  localStorage.setItem('admin_theme', enabled ? 'dark' : 'light')
})

async function loadBusinesses() {
  const requestId = ++businessLoadRequestId
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/businesses', { params: { page: page.value, per_page: 10, include_deleted: includeDeleted.value, search: search.value.trim() || undefined } })
    if (requestId !== businessLoadRequestId) return
    const lastPage = Math.max(1, Number(data.last_page) || 1)
    if (page.value > lastPage) {
      page.value = lastPage
      await loadBusinesses()
      return
    }
    businesses.value = data.data || []
    pagination.value = {
      current_page: Number(data.current_page) || page.value,
      last_page: lastPage,
      total: Number(data.total) || 0,
    }
  } catch (requestError) {
    if (requestId === businessLoadRequestId) {
      error.value = requestError.response?.data?.message || t('admin.unableLoadBusinesses')
    }
  } finally {
    if (requestId === businessLoadRequestId) loading.value = false
  }
}

function changePage(nextPage) {
  if (loading.value || nextPage < 1 || nextPage > (pagination.value?.last_page || 1)) return
  page.value = nextPage
  loadBusinesses()
}

function toggleDeleted() {
  includeDeleted.value = !includeDeleted.value
  page.value = 1
  loadBusinesses()
}

watch(search, () => {
  page.value = 1
  loadBusinesses()
})

function openCreate() {
  formError.value = ''
  form.value = { currency: 'TZS' }
  formOpen.value = true
}

async function createBusiness() {
  formError.value = ''
  if (form.value.owner_password && form.value.owner_password !== form.value.owner_password_confirmation) {
    formError.value = t('admin.passwordConfirmationMismatch')
    return
  }
  saving.value = true
  try {
    await api.post('/admin/businesses', form.value)
    formOpen.value = false
    page.value = 1
    await loadBusinesses()
  } catch (requestError) {
    formError.value = requestError.response?.data?.message
      || Object.values(requestError.response?.data?.errors || {}).flat()[0]
      || t('admin.unableCreateBusiness')
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
    error.value = requestError.response?.data?.message || t('admin.unableChangeStatus')
  }
}

function removeBusiness(item) {
  removeBusinessTarget.value = item
  removeBusinessData.value = false
}

async function confirmRemoveBusiness() {
  const item = removeBusinessTarget.value
  if (!item) return
  error.value = ''
  notice.value = ''
  saving.value = true
  try {
    const { data } = await api.delete(`/admin/businesses/${item.id}`, { data: { delete_data: removeBusinessData.value } })
    removeBusinessTarget.value = null
    notice.value = data.image_cleanup_pending
      ? `${data.message} ${data.image_cleanup_pending} product image file(s) remain queued for cleanup.`
      : data.message || t('admin.businessRemoved')
    await loadBusinesses()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('admin.unableRemoveBusiness')
  } finally {
    saving.value = false
  }
}

async function restoreBusiness(item) {
  error.value = ''
  try {
    await api.post(`/admin/businesses/${item.id}/restore`)
    await loadBusinesses()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('admin.unableRestoreBusiness')
  }
}

async function logout() {
  try {
    await auth.logout()
  } finally {
    await router.push({ name: 'login' })
  }
}

onMounted(async () => {
  try {
    await loadBusinesses()
  } finally {
    auth.finishDashboardPreparation()
  }
})
</script>

<template>
  <main class="admin-page" :class="{ 'admin-dark': darkTheme }">
    <header class="admin-topbar">
      <div class="admin-brand" :aria-label="t('admin.platformAdministration')">
        <span class="admin-brand-mark"><BriefcaseBusiness :size="20" /></span>
        <span><strong>Bizikua</strong><small>{{ t('admin.platformAdministration') }}</small></span>
      </div>
      <div class="admin-account">
        <span class="admin-account-avatar">{{ auth.user?.name?.slice(0, 1)?.toUpperCase() || 'A' }}</span>
        <span class="admin-account-name">{{ auth.user?.name || t('admin.administrator') }}</span>
        <LanguageSwitcher />
        <button class="admin-theme-toggle" type="button" :aria-label="darkTheme ? t('admin.switchToLight') : t('admin.switchToDark')" :title="darkTheme ? t('admin.switchToLight') : t('admin.switchToDark')" @click="darkTheme = !darkTheme">
          <Sun v-if="darkTheme" :size="19" /><Moon v-else :size="19" />
        </button>
        <button class="button button-secondary admin-signout" @click="logout"><LogOut :size="16" /><span>{{ t('logout') }}</span></button>
      </div>
    </header>

    <div class="admin-content">
      <section class="admin-welcome">
        <div>
          <p class="admin-eyebrow"><Shield :size="13" /> {{ t('admin.platformAdministration') }}</p>
          <h1>{{ t('admin.businessAccounts') }}</h1>
          <p>{{ t('admin.manageBusinessAccounts') }}</p>
        </div>
        <button class="button admin-create-trigger" @click="openCreate"><Plus :size="16" /> {{ t('createBusiness') }}</button>
      </section>

      <div v-if="error" class="admin-alert" role="alert">{{ error }}</div>
      <div v-if="notice" class="admin-alert success" role="status">{{ notice }}</div>

      <section class="admin-stats" :aria-label="t('admin.accountOverview')">
        <article class="admin-stat-card">
          <span class="admin-stat-icon"><Building2 :size="18" /></span>
          <span class="admin-stat-label">{{ t('admin.totalBusinesses') }}</span>
          <strong>{{ pagination ? pagination.total : businesses.length }}</strong>
          <small>{{ t('admin.acrossPlatform') }}</small>
        </article>
        <article class="admin-stat-card">
          <span class="admin-stat-icon active"><CircleCheck :size="18" /></span>
          <span class="admin-stat-label">{{ t('admin.activeOnPage') }}</span>
          <strong>{{ activeOnPage }}</strong>
          <small>{{ t('admin.businessesInGoodStanding') }}</small>
        </article>
        <article class="admin-stat-card">
          <span class="admin-stat-icon paused"><CirclePause :size="18" /></span>
          <span class="admin-stat-label">{{ t('admin.suspendedOnPage') }}</span>
          <strong>{{ suspendedOnPage }}</strong>
          <small>{{ t('admin.accessPaused') }}</small>
        </article>
      </section>

      <section class="admin-business-panel">
        <div class="admin-panel-heading">
          <div class="admin-panel-title">
            <span class="admin-panel-icon"><BriefcaseBusiness :size="18" /></span>
            <div><h2>{{ includeDeleted ? t('admin.allBusinessesIncludingRemoved') : t('allBusinesses') }}</h2><p>{{ t('admin.reviewBusinessAccounts') }}</p></div>
          </div>
          <span class="admin-results">{{ pagination ? pagination.total : businesses.length }} {{ t((pagination ? pagination.total : businesses.length) === 1 ? 'admin.businessSingular' : 'admin.businessPlural') }}</span>
        </div>

        <div class="admin-toolbar">
          <label class="admin-search">
            <Search :size="17" />
            <input v-model="search" type="search" :placeholder="t('admin.searchPlaceholder')" :aria-label="t('admin.searchAria')" />
          </label>
          <div class="admin-toolbar-actions">
            <button class="button button-secondary" :disabled="loading" @click="toggleDeleted">{{ includeDeleted ? t('admin.hideRemoved') : t('admin.showRemoved') }}</button>
            <button class="button button-secondary admin-refresh" :disabled="loading" @click="loadBusinesses"><RefreshCw :size="16" /><span>{{ t('admin.refresh') }}</span></button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>{{ t('businessName') }}</th><th>{{ t('admin.owner') }}</th><th>{{ t('currency') }}</th><th>{{ t('status') }}</th><th class="admin-actions-heading">{{ t('actions') }}</th></tr></thead>
            <tbody>
              <tr v-if="loading" class="admin-state-row"><td colspan="5"><div class="admin-empty">{{ t('admin.loadingBusinesses') }}</div></td></tr>
              <tr v-else-if="!businesses.length" class="admin-state-row"><td colspan="5"><div class="admin-empty"><Building2 :size="22" />{{ search ? t('admin.noBusinessesMatch') : t('admin.noBusinessesYet') }}</div></td></tr>
              <tr v-for="item in businesses" :key="item.id">
                <td :data-label="t('businessName')">
                  <div class="admin-business-cell">
                    <span class="admin-business-avatar">{{ item.name?.slice(0, 1)?.toUpperCase() || 'B' }}</span>
                    <span class="admin-business-text"><strong>{{ item.name }}</strong><small>{{ item.business_type || t('admin.businessAccount') }}</small></span>
                  </div>
                </td>
                <td :data-label="t('admin.owner')">
                  <div class="admin-owner-cell">
                    <span class="admin-owner-icon"><UserRound :size="16" /></span>
                    <span class="admin-owner-text"><strong>{{ item.users?.[0]?.name || t('admin.ownerNotListed') }}</strong><small>{{ item.users?.[0]?.email || '—' }}</small></span>
                  </div>
                </td>
                <td :data-label="t('currency')"><span class="admin-currency">{{ item.currency || '—' }}</span></td>
                <td :data-label="t('status')"><span class="admin-status" :class="item.deleted_at ? 'removed' : item.status">{{ t(item.deleted_at ? 'removed' : item.status) }}</span></td>
                <td :data-label="t('actions')">
                  <div class="admin-actions-cell">
                    <button v-if="item.deleted_at" class="admin-action-button restore" @click="restoreBusiness(item)">{{ t('admin.restore') }}</button>
                    <template v-else>
                      <button class="admin-action-button" :class="item.status === 'active' ? 'suspend' : 'activate'" @click="toggleStatus(item)">{{ item.status === 'active' ? t('admin.suspend') : t('admin.activate') }}</button>
                      <button class="admin-action-button remove" @click="removeBusiness(item)"><Trash2 :size="13" />{{ t('admin.remove') }}</button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pagination && pagination.last_page > 1" class="admin-pagination">
          <span>{{ t('admin.showingPage') }} <strong>{{ pagination.current_page }}</strong> {{ t('of') }} <strong>{{ pagination.last_page }}</strong></span>
          <div>
            <button class="button button-secondary" :disabled="page <= 1 || loading" @click="changePage(page - 1)">{{ t('previous') }}</button>
            <button class="button button-secondary" :disabled="page >= pagination.last_page || loading" @click="changePage(page + 1)">{{ t('next') }}</button>
          </div>
        </div>
      </section>
      </div>

    <div v-if="formOpen" class="modal-backdrop admin-modal-backdrop" @click.self="formOpen = false">
      <form class="admin-create-dialog" @submit.prevent="createBusiness">
        <header class="admin-create-header">
          <span class="admin-create-icon"><Building2 :size="20" /></span>
          <div><p>{{ t('admin.platformAdministration') }}</p><h2>{{ t('admin.createABusiness') }}</h2><small>{{ t('admin.setupBusinessHint') }}</small></div>
          <button class="admin-dialog-close" type="button" aria-label="Close" :disabled="saving" @click="formOpen = false"><X :size="18" /></button>
        </header>
        <div class="admin-create-body">
          <div v-if="formError" class="admin-alert" role="alert">{{ formError }}</div>
          <section class="admin-form-section">
            <div class="admin-form-section-heading"><span><Building2 :size="16" /></span><div><h3>{{ t('admin.businessDetails') }}</h3><p>{{ t('admin.businessDetailsHint') }}</p></div></div>
            <div class="admin-create-grid">
              <label>{{ t('businessName') }} <em>*</em><input v-model="form.name" name="business-name" required maxlength="150" :placeholder="t('admin.businessNameExample')"></label>
              <label>{{ t('businessType') }}<input v-model="form.business_type" name="business-type" maxlength="100" :placeholder="t('admin.businessTypeExample')"></label>
              <label>{{ t('admin.businessPhone') }}<input v-model="form.phone" name="business-phone" maxlength="30" placeholder="+255…"></label>
              <label>{{ t('admin.businessEmail') }}<input v-model="form.email" name="business-email" type="email" maxlength="150" placeholder="business@example.com"></label>
              <label class="admin-form-span">{{ t('admin.businessAddress') }}<input v-model="form.address" name="business-address" maxlength="1000" :placeholder="t('admin.addressExample')"></label>
              <label>{{ t('currency') }}<select v-model="form.currency" name="business-currency"><option>TZS</option><option>KES</option><option>UGX</option><option>USD</option></select></label>
            </div>
          </section>
          <section class="admin-form-section owner-section">
            <div class="admin-form-section-heading"><span><UserRound :size="16" /></span><div><h3>{{ t('admin.businessOwner') }}</h3><p>{{ t('admin.assignOwnerHint') }}</p></div></div>
            <div class="admin-create-grid">
              <label>{{ t('admin.ownerFullName') }} <em>*</em><input v-model="form.owner_name" name="owner-name" required maxlength="150" :placeholder="t('admin.fullName')"></label>
              <label>{{ t('ownerEmail') }} <em>*</em><input v-model="form.owner_email" name="owner-email" required type="email" maxlength="150" placeholder="owner@example.com"></label>
              <label>{{ t('admin.ownerPhone') }}<input v-model="form.owner_phone" name="owner-phone" maxlength="30" placeholder="+255…"></label>
              <label>{{ t('admin.initialPassword') }}<input v-model="form.owner_password" name="owner-password" type="password" minlength="12" autocomplete="new-password" :placeholder="t('admin.passwordLengthHint')"></label>
              <label class="admin-form-span">{{ t('admin.confirmInitialPassword') }}<input v-model="form.owner_password_confirmation" name="owner-password-confirmation" type="password" minlength="12" autocomplete="new-password" :placeholder="t('admin.enterPasswordAgain')"></label>
            </div>
            <p class="admin-password-hint">{{ t('admin.ownerPasswordHint') }}</p>
          </section>
        </div>
        <footer class="admin-create-footer">
          <button class="button button-secondary" type="button" :disabled="saving" @click="formOpen = false">{{ t('cancel') }}</button>
          <button class="button admin-create-submit" type="submit" :disabled="saving"><Plus :size="15" />{{ saving ? t('admin.creating') : t('createBusiness') }}</button>
        </footer>
      </form>
    </div>

    <div v-if="removeBusinessTarget" class="modal-backdrop" @click.self="removeBusinessTarget = null">
      <section class="modal-card admin-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-business-title">
        <div class="admin-dialog-heading">
          <span class="admin-dialog-icon" :class="{ destructive: removeBusinessData }"><Trash2 v-if="removeBusinessData" :size="20" /><Archive v-else :size="20" /></span>
          <button class="admin-dialog-close" type="button" aria-label="Close" :disabled="saving" @click="removeBusinessTarget = null"><X :size="18" /></button>
          <p class="admin-dialog-kicker">{{ t('admin.businessAccount') }}</p>
          <h2 id="remove-business-title">{{ removeBusinessData ? t('admin.permanentlyDeleteBusinessQuestion') : t('admin.removeBusinessQuestion') }}</h2>
          <p class="admin-dialog-description"><strong>{{ removeBusinessTarget.name }}</strong> · {{ t('admin.chooseSavedRecordsAction') }}</p>
        </div>
        <div class="admin-removal-options" role="radiogroup" :aria-label="t('admin.removalOptions')">
          <label class="admin-removal-option" :class="{ selected: !removeBusinessData }">
            <input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="false">
            <span class="admin-removal-option-icon"><Archive :size="17" /></span>
            <span><strong>{{ t('admin.removeKeepData') }}</strong><small>{{ t('admin.removeKeepDataHint') }}</small></span>
            <span class="admin-radio-mark"></span>
          </label>
          <label class="admin-removal-option destructive" :class="{ selected: removeBusinessData }">
            <input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="true">
            <span class="admin-removal-option-icon"><Trash2 :size="17" /></span>
            <span><strong>{{ t('admin.permanentlyDeleteEverything') }}</strong><small>{{ t('admin.permanentlyDeleteHint') }}</small></span>
            <span class="admin-radio-mark"></span>
          </label>
        </div>
        <div v-if="removeBusinessData" class="admin-delete-warning" role="alert"><AlertTriangle :size="16" /><span>{{ t('admin.deleteWarning') }}</span></div>
        <div class="admin-dialog-actions">
          <button class="button button-secondary" type="button" :disabled="saving" @click="removeBusinessTarget = null">{{ t('cancel') }}</button>
          <button class="button admin-confirm-remove" :class="{ destructive: removeBusinessData }" type="button" :disabled="saving" @click="confirmRemoveBusiness"><Trash2 v-if="removeBusinessData" :size="15" /><Archive v-else :size="15" />{{ saving ? t('admin.removing') : removeBusinessData ? t('admin.permanentlyDelete') : t('admin.removeBusiness') }}</button>
        </div>
      </section>
    </div>
  </main>
</template>
