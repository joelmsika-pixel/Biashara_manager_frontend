<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertTriangle, Archive, Building2, BriefcaseBusiness, CircleCheck, CirclePause, LogOut, Plus,
  RefreshCw, Search, Shield, Trash2, UserRound, X,
} from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
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
      error.value = requestError.response?.data?.message || 'Unable to load businesses.'
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
    formError.value = 'The password confirmation does not match.'
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
      || 'Unable to create the business.'
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
    error.value = requestError.response?.data?.message || 'Unable to change business status.'
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
      : data.message || 'Business removed.'
    await loadBusinesses()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Unable to remove the business.'
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
    error.value = requestError.response?.data?.message || 'Unable to restore the business.'
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
  <main class="admin-page">
    <header class="admin-topbar">
      <div class="admin-brand" aria-label="Platform administration">
        <span class="admin-brand-mark"><BriefcaseBusiness :size="20" /></span>
        <span><strong>Bizikua</strong><small>PLATFORM ADMINISTRATION</small></span>
      </div>
      <div class="admin-account">
        <span class="admin-account-avatar">{{ auth.user?.name?.slice(0, 1)?.toUpperCase() || 'A' }}</span>
        <span class="admin-account-name">{{ auth.user?.name || 'Administrator' }}</span>
        <button class="button button-secondary admin-signout" @click="logout"><LogOut :size="16" /><span>Sign out</span></button>
      </div>
    </header>

    <div class="admin-content">
      <section class="admin-welcome">
        <div>
          <p class="admin-eyebrow"><Shield :size="13" /> Platform administration</p>
          <h1>Business accounts</h1>
          <p>Manage business profiles, owners, and platform access.</p>
        </div>
        <button class="button admin-create-trigger" @click="openCreate"><Plus :size="16" /> Create business</button>
      </section>

      <div v-if="error" class="admin-alert" role="alert">{{ error }}</div>
      <div v-if="notice" class="admin-alert success" role="status">{{ notice }}</div>

      <section class="admin-stats" aria-label="Business account overview">
        <article class="admin-stat-card">
          <span class="admin-stat-icon"><Building2 :size="18" /></span>
          <span class="admin-stat-label">Total businesses</span>
          <strong>{{ pagination ? pagination.total : businesses.length }}</strong>
          <small>Across the platform</small>
        </article>
        <article class="admin-stat-card">
          <span class="admin-stat-icon active"><CircleCheck :size="18" /></span>
          <span class="admin-stat-label">Active on this page</span>
          <strong>{{ activeOnPage }}</strong>
          <small>Business accounts in good standing</small>
        </article>
        <article class="admin-stat-card">
          <span class="admin-stat-icon paused"><CirclePause :size="18" /></span>
          <span class="admin-stat-label">Suspended on this page</span>
          <strong>{{ suspendedOnPage }}</strong>
          <small>Access currently paused</small>
        </article>
      </section>

      <section class="admin-business-panel">
        <div class="admin-panel-heading">
          <div class="admin-panel-title">
            <span class="admin-panel-icon"><BriefcaseBusiness :size="18" /></span>
            <div><h2>{{ includeDeleted ? 'All businesses, including removed' : 'All businesses' }}</h2><p>Review business profiles and manage their account status.</p></div>
          </div>
          <span class="admin-results">{{ pagination ? pagination.total : businesses.length }} {{ pagination?.total === 1 ? 'business' : 'businesses' }}</span>
        </div>

        <div class="admin-toolbar">
          <label class="admin-search">
            <Search :size="17" />
            <input v-model="search" type="search" placeholder="Search business or owner…" aria-label="Search businesses or owners" />
          </label>
          <div class="admin-toolbar-actions">
            <button class="button button-secondary" :disabled="loading" @click="toggleDeleted">{{ includeDeleted ? 'Hide removed' : 'Show removed' }}</button>
            <button class="button button-secondary admin-refresh" :disabled="loading" @click="loadBusinesses"><RefreshCw :size="16" /><span>Refresh</span></button>
          </div>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Business</th><th>Owner</th><th>Currency</th><th>Status</th><th class="admin-actions-heading">Actions</th></tr></thead>
            <tbody>
              <tr v-if="loading"><td colspan="5"><div class="admin-empty"><span class="admin-loading-dot"></span>Loading businesses…</div></td></tr>
              <tr v-else-if="!businesses.length"><td colspan="5"><div class="admin-empty"><Building2 :size="22" />{{ search ? 'No businesses match your search.' : 'No businesses yet.' }}</div></td></tr>
              <tr v-for="item in businesses" :key="item.id">
                <td>
                  <div class="admin-business-cell">
                    <span class="admin-business-avatar">{{ item.name?.slice(0, 1)?.toUpperCase() || 'B' }}</span>
                    <span class="admin-business-text"><strong>{{ item.name }}</strong><small>{{ item.business_type || 'Business account' }}</small></span>
                  </div>
                </td>
                <td>
                  <div class="admin-owner-cell">
                    <span class="admin-owner-icon"><UserRound :size="16" /></span>
                    <span class="admin-owner-text"><strong>{{ item.users?.[0]?.name || 'Owner not listed' }}</strong><small>{{ item.users?.[0]?.email || '—' }}</small></span>
                  </div>
                </td>
                <td><span class="admin-currency">{{ item.currency || '—' }}</span></td>
                <td><span class="admin-status" :class="item.deleted_at ? 'removed' : item.status"><i></i>{{ item.deleted_at ? 'Removed' : item.status }}</span></td>
                <td>
                  <div class="admin-actions-cell">
                    <button v-if="item.deleted_at" class="admin-action-button restore" @click="restoreBusiness(item)">Restore</button>
                    <template v-else>
                      <button class="admin-action-button" :class="item.status === 'active' ? 'suspend' : 'activate'" @click="toggleStatus(item)">{{ item.status === 'active' ? 'Suspend' : 'Activate' }}</button>
                      <button class="admin-action-button remove" @click="removeBusiness(item)"><Trash2 :size="13" />Remove</button>
                    </template>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="pagination && pagination.last_page > 1" class="admin-pagination">
          <span>Showing page <strong>{{ pagination.current_page }}</strong> of <strong>{{ pagination.last_page }}</strong></span>
          <div>
            <button class="button button-secondary" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Previous</button>
            <button class="button button-secondary" :disabled="page >= pagination.last_page || loading" @click="changePage(page + 1)">Next</button>
          </div>
        </div>
      </section>
      </div>

    <div v-if="formOpen" class="modal-backdrop admin-modal-backdrop" @click.self="formOpen = false">
      <form class="admin-create-dialog" @submit.prevent="createBusiness">
        <header class="admin-create-header">
          <span class="admin-create-icon"><Building2 :size="20" /></span>
          <div><p>PLATFORM ADMINISTRATION</p><h2>Create a business</h2><small>Set up the business profile and assign its owner.</small></div>
          <button class="admin-dialog-close" type="button" aria-label="Close" :disabled="saving" @click="formOpen = false"><X :size="18" /></button>
        </header>
        <div class="admin-create-body">
          <div v-if="formError" class="admin-alert" role="alert">{{ formError }}</div>
          <section class="admin-form-section">
            <div class="admin-form-section-heading"><span><Building2 :size="16" /></span><div><h3>Business details</h3><p>Basic information shown on the business account.</p></div></div>
            <div class="admin-create-grid">
              <label>Business name <em>*</em><input v-model="form.name" name="business-name" required maxlength="150" placeholder="e.g. Greenfield Traders"></label>
              <label>Business type<input v-model="form.business_type" name="business-type" maxlength="100" placeholder="e.g. Retail"></label>
              <label>Business phone<input v-model="form.phone" name="business-phone" maxlength="30" placeholder="+255…"></label>
              <label>Business email<input v-model="form.email" name="business-email" type="email" maxlength="150" placeholder="business@example.com"></label>
              <label class="admin-form-span">Business address<input v-model="form.address" name="business-address" maxlength="1000" placeholder="Street, city, region"></label>
              <label>Currency<select v-model="form.currency" name="business-currency"><option>TZS</option><option>KES</option><option>UGX</option><option>USD</option></select></label>
            </div>
          </section>
          <section class="admin-form-section owner-section">
            <div class="admin-form-section-heading"><span><UserRound :size="16" /></span><div><h3>Business owner</h3><p>Assign the primary account administrator.</p></div></div>
            <div class="admin-create-grid">
              <label>Owner full name <em>*</em><input v-model="form.owner_name" name="owner-name" required maxlength="150" placeholder="Full name"></label>
              <label>Owner email <em>*</em><input v-model="form.owner_email" name="owner-email" required type="email" maxlength="150" placeholder="owner@example.com"></label>
              <label>Owner phone<input v-model="form.owner_phone" name="owner-phone" maxlength="30" placeholder="+255…"></label>
              <label>Initial password<input v-model="form.owner_password" name="owner-password" type="password" minlength="12" autocomplete="new-password" placeholder="At least 12 characters"></label>
              <label class="admin-form-span">Confirm initial password<input v-model="form.owner_password_confirmation" name="owner-password-confirmation" type="password" minlength="12" autocomplete="new-password" placeholder="Enter the password again"></label>
            </div>
            <p class="admin-password-hint">A new owner password must have at least 12 characters. Existing accounts keep their current password.</p>
          </section>
        </div>
        <footer class="admin-create-footer">
          <button class="button button-secondary" type="button" :disabled="saving" @click="formOpen = false">Cancel</button>
          <button class="button admin-create-submit" type="submit" :disabled="saving"><Plus :size="15" />{{ saving ? 'Creating…' : 'Create business' }}</button>
        </footer>
      </form>
    </div>

    <div v-if="removeBusinessTarget" class="modal-backdrop" @click.self="removeBusinessTarget = null">
      <section class="modal-card admin-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-business-title">
        <div class="admin-dialog-heading">
          <span class="admin-dialog-icon" :class="{ destructive: removeBusinessData }"><Trash2 v-if="removeBusinessData" :size="20" /><Archive v-else :size="20" /></span>
          <button class="admin-dialog-close" type="button" aria-label="Close" :disabled="saving" @click="removeBusinessTarget = null"><X :size="18" /></button>
          <p class="admin-dialog-kicker">Business account</p>
          <h2 id="remove-business-title">{{ removeBusinessData ? 'Permanently delete business?' : 'Remove business?' }}</h2>
          <p class="admin-dialog-description"><strong>{{ removeBusinessTarget.name }}</strong> · Choose what happens to its saved records.</p>
        </div>
        <div class="admin-removal-options" role="radiogroup" aria-label="Business data removal options">
          <label class="admin-removal-option" :class="{ selected: !removeBusinessData }">
            <input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="false">
            <span class="admin-removal-option-icon"><Archive :size="17" /></span>
            <span><strong>Remove and keep data</strong><small>Business access is removed. You can restore the business later.</small></span>
            <span class="admin-radio-mark"></span>
          </label>
          <label class="admin-removal-option destructive" :class="{ selected: removeBusinessData }">
            <input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="true">
            <span class="admin-removal-option-icon"><Trash2 :size="17" /></span>
            <span><strong>Permanently delete everything</strong><small>Business records and product images will be deleted and cannot be restored.</small></span>
            <span class="admin-radio-mark"></span>
          </label>
        </div>
        <div v-if="removeBusinessData" class="admin-delete-warning" role="alert"><AlertTriangle :size="16" /><span>The owner's account is deleted only if they have no other business memberships. This action cannot be undone.</span></div>
        <div class="admin-dialog-actions">
          <button class="button button-secondary" type="button" :disabled="saving" @click="removeBusinessTarget = null">Cancel</button>
          <button class="button admin-confirm-remove" :class="{ destructive: removeBusinessData }" type="button" :disabled="saving" @click="confirmRemoveBusiness"><Trash2 v-if="removeBusinessData" :size="15" /><Archive v-else :size="15" />{{ saving ? 'Removing…' : removeBusinessData ? 'Permanently delete' : 'Remove business' }}</button>
        </div>
      </section>
    </div>
  </main>
</template>
