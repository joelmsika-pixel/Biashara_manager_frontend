<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, LogOut, Plus, RefreshCw, Shield, Trash2 } from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
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

async function loadBusinesses() {
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/businesses', { params: { per_page: 100, include_deleted: includeDeleted.value } })
    businesses.value = data.data || []
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Unable to load businesses.'
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
    confirmError.value = requestError.response?.data?.message || 'Unable to remove the business.'
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

onMounted(loadBusinesses)
</script>

<template>
  <main class="content admin-page">
    <header class="admin-page-heading">
      <div class="admin-heading-copy">
        <p class="eyebrow"><Shield :size="14" /> Platform administration</p>
        <h1>Businesses</h1>
        <p class="page-subtitle">Manage business accounts and their owners.</p>
      </div>
      <div class="admin-page-actions">
        <button class="button button-secondary" type="button" @click="includeDeleted = !includeDeleted; loadBusinesses()">
          {{ includeDeleted ? 'Hide removed' : 'Show removed' }}
        </button>
        <button class="button button-secondary" type="button" :disabled="loading" @click="loadBusinesses">
          <RefreshCw :size="16" :class="{ 'admin-refreshing': loading }" /> Refresh
        </button>
        <button class="button button-primary" type="button" @click="openCreate"><Plus :size="16" /> Create business</button>
        <button class="button button-secondary admin-sign-out" type="button" @click="logout"><LogOut :size="16" /> Sign out</button>
      </div>
    </header>

    <div v-if="error" class="notice-banner" role="alert">{{ error }}</div>
    <section class="admin-summary" aria-label="Business summary">
      <article class="admin-summary-card">
        <span class="admin-summary-icon"><BriefcaseBusiness :size="18" /></span>
        <div><span>Businesses listed</span><strong>{{ businesses.length }}</strong></div>
      </article>
      <article class="admin-summary-card admin-summary-active">
        <span class="admin-summary-icon"><Shield :size="18" /></span>
        <div><span>Active</span><strong>{{ activeCount }}</strong></div>
      </article>
      <article class="admin-summary-card admin-summary-inactive">
        <span class="admin-summary-icon"><RefreshCw :size="18" /></span>
        <div><span>Suspended or removed</span><strong>{{ inactiveCount }}</strong></div>
      </article>
    </section>

    <section class="panel-card admin-business-panel">
      <div class="admin-panel-heading">
        <div class="admin-panel-title">
          <span class="admin-panel-icon"><BriefcaseBusiness :size="18" /></span>
          <div>
            <h2>All businesses</h2>
            <p>Manage account status and business owners.</p>
          </div>
        </div>
        <span class="admin-list-count">{{ businesses.length }} <span>listed</span></span>
      </div>
      <div v-if="loading && !businesses.length" class="admin-grid-state" role="status">
        <span class="admin-loader"></span>Loading businesses…
      </div>
      <div v-else-if="!loading && !businesses.length" class="admin-grid-state">
        No businesses to show yet.
      </div>
      <div v-else class="admin-business-grid">
        <div v-if="loading" class="admin-refresh-note" role="status"><span class="admin-loader"></span>Updating business list</div>
        <article v-for="item in businesses" :key="item.id" class="admin-business-card">
          <div class="admin-business-card-top">
            <span class="admin-business-avatar">{{ businessInitials(item.name) }}</span>
            <span class="admin-status" :class="item.deleted_at ? 'admin-status-removed' : `admin-status-${item.status}`">
              <span></span>{{ item.deleted_at ? 'Removed' : item.status }}
            </span>
          </div>
          <div class="admin-business-card-title">
            <span>{{ item.business_type || 'Business account' }}</span>
            <h3>{{ item.name }}</h3>
          </div>
          <div class="admin-business-card-owner">
            <span class="admin-card-label">Account owner</span>
            <div class="admin-owner-entry">
              <span class="admin-owner-avatar">{{ businessInitials(item.users?.[0]?.name || '?') }}</span>
              <span class="admin-owner-copy">
                <strong>{{ item.users?.[0]?.name || 'No owner assigned' }}</strong>
                <small>{{ item.users?.[0]?.email || 'Owner details unavailable' }}</small>
              </span>
            </div>
          </div>
          <div class="admin-business-card-facts">
            <span>Reporting currency</span>
            <strong>{{ item.currency }}</strong>
          </div>
          <div class="admin-row-actions">
            <button v-if="item.deleted_at" class="admin-action admin-action-restore" type="button" @click="restoreBusiness(item)">Restore business</button>
            <template v-else>
              <button class="admin-action admin-action-status" type="button" @click="toggleStatus(item)">{{ item.status === 'active' ? 'Suspend' : 'Activate' }}</button>
              <button class="admin-action admin-action-remove" type="button" @click="removeBusiness(item)">Remove</button>
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
            <p class="eyebrow">Destructive action</p>
            <h2 id="admin-confirm-title">Remove this business?</h2>
          </div>
        </div>
        <p class="admin-confirm-message">
          You're about to remove <strong>{{ confirmRemoval.name }}</strong>. Its records will be preserved, and you can restore the business later.
        </p>
        <p v-if="confirmError" class="form-error admin-confirm-error" role="alert">{{ confirmError }}</p>
        <div class="admin-confirm-actions">
          <button class="button button-secondary" type="button" :disabled="removing" @click="closeRemovalConfirmation">Cancel</button>
          <button class="button admin-confirm-danger" type="button" :disabled="removing" @click="confirmRemoveBusiness">
            {{ removing ? 'Removing…' : 'Remove business' }}
          </button>
        </div>
      </section>
    </div>

    <div v-if="formOpen" class="modal-backdrop" @click.self="formOpen = false">
      <form class="modal-card" @submit.prevent="createBusiness">
        <div class="panel-heading"><h2>Create a business</h2><button class="icon-button" type="button" aria-label="Close" @click="formOpen = false">×</button></div>
        <div v-if="formError" class="form-error" role="alert">{{ formError }}</div>
        <div class="form-grid">
          <label>Business name<input v-model="form.name" required maxlength="150"></label>
          <label>Business type<input v-model="form.business_type" maxlength="100"></label>
          <label>Business phone<input v-model="form.phone" maxlength="30"></label>
          <label>Business email<input v-model="form.email" type="email" maxlength="150"></label>
          <label>Address<input v-model="form.address" maxlength="1000"></label>
          <label>Currency<select v-model="form.currency"><option>TZS</option><option>KES</option><option>UGX</option><option>USD</option></select></label>
          <label>Owner name<input v-model="form.owner_name" required maxlength="150"></label>
          <label>Owner email<input v-model="form.owner_email" required type="email" maxlength="150"></label>
          <label>Owner phone<input v-model="form.owner_phone" maxlength="30"></label>
          <label>Initial owner password<input v-model="form.owner_password" type="password" minlength="12" autocomplete="new-password"></label>
        </div>
        <p class="page-subtitle">A new owner password must have at least 12 characters. Existing accounts keep their current password.</p>
        <div class="heading-actions">
          <button class="button button-secondary" type="button" @click="formOpen = false">Cancel</button>
          <button class="button button-primary" type="submit" :disabled="saving">{{ saving ? 'Creating…' : 'Create business' }}</button>
        </div>
      </form>
    </div>
  </main>
</template>
