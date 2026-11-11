<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, LogOut, Plus, RefreshCw, Shield } from '@lucide/vue'
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

async function removeBusiness(item) {
  if (!window.confirm(`Remove ${item.name}? Its records will be preserved.`)) return
  error.value = ''
  try {
    await api.delete(`/admin/businesses/${item.id}`)
    await loadBusinesses()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Unable to remove the business.'
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
  <main class="content" style="max-width: 1200px; min-height: 100vh">
    <header class="page-heading">
      <div>
        <p class="eyebrow"><Shield :size="14" /> Platform administration</p>
        <h1>Businesses</h1>
        <p class="page-subtitle">Manage business accounts and their owners.</p>
      </div>
      <div class="heading-actions">
        <button class="button button-secondary" @click="includeDeleted = !includeDeleted; loadBusinesses()">{{ includeDeleted ? 'Hide removed' : 'Show removed' }}</button>
        <button class="button button-secondary" :disabled="loading" @click="loadBusinesses"><RefreshCw :size="16" /> Refresh</button>
        <button class="button button-primary" @click="openCreate"><Plus :size="16" /> Create business</button>
        <button class="button button-secondary" @click="logout"><LogOut :size="16" /> Sign out</button>
      </div>
    </header>

    <div v-if="error" class="notice-banner" role="alert">{{ error }}</div>
    <section class="panel-card">
      <div class="panel-heading">
        <div class="card-title-row"><span class="metric-icon green"><BriefcaseBusiness :size="17" /></span><strong>All businesses</strong></div>
        <span>{{ businesses.length }} listed</span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Business</th><th>Owner</th><th>Currency</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="loading"><td colspan="5">Loading businesses…</td></tr>
            <tr v-else-if="!businesses.length"><td colspan="5">No businesses yet.</td></tr>
            <tr v-for="item in businesses" :key="item.id">
              <td><strong>{{ item.name }}</strong><small>{{ item.business_type || '—' }}</small></td>
              <td>{{ item.users?.[0]?.name || '—' }}<small>{{ item.users?.[0]?.email || '' }}</small></td>
              <td>{{ item.currency }}</td>
              <td><span class="status-badge" :class="item.deleted_at ? 'suspended' : item.status">{{ item.deleted_at ? 'Removed' : item.status }}</span></td>
              <td>
                <button v-if="item.deleted_at" class="button button-secondary" @click="restoreBusiness(item)">Restore</button>
                <template v-else>
                  <button class="button button-secondary" @click="toggleStatus(item)">{{ item.status === 'active' ? 'Suspend' : 'Activate' }}</button>
                  <button class="button button-secondary" @click="removeBusiness(item)">Remove</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

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
