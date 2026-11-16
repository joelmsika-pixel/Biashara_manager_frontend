<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BriefcaseBusiness, LogOut, Plus, RefreshCw, Shield } from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const businesses = ref([])
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

async function loadBusinesses() {
  const requestId = ++businessLoadRequestId
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get('/admin/businesses', { params: { page: page.value, per_page: 10, include_deleted: includeDeleted.value } })
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
  if (removeBusinessData.value && !window.confirm(`Permanently delete ${item.name} and all its business data? This cannot be undone.`)) return
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
  <main class="content" style="max-width: 1200px; min-height: 100vh">
    <header class="page-heading">
      <div>
        <p class="eyebrow"><Shield :size="14" /> Platform administration</p>
        <h1>Businesses</h1>
        <p class="page-subtitle">Manage business accounts and their owners.</p>
      </div>
      <div class="heading-actions">
        <button class="button button-secondary" :disabled="loading" @click="toggleDeleted">{{ includeDeleted ? 'Hide removed' : 'Show removed' }}</button>
        <button class="button button-secondary" :disabled="loading" @click="loadBusinesses"><RefreshCw :size="16" /> Refresh</button>
        <button class="button button-primary" @click="openCreate"><Plus :size="16" /> Create business</button>
        <button class="button button-secondary" @click="logout"><LogOut :size="16" /> Sign out</button>
      </div>
    </header>

    <div v-if="error" class="notice-banner" role="alert">{{ error }}</div>
    <div v-if="notice" class="notice-banner" role="status">{{ notice }}</div>
    <section class="panel-card">
      <div class="panel-heading">
        <div class="card-title-row"><span class="metric-icon green"><BriefcaseBusiness :size="17" /></span><strong>All businesses</strong></div>
        <span>{{ pagination ? pagination.total : businesses.length }} listed</span>
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
      <div v-if="pagination && pagination.last_page > 1" class="pagination">
        <span>Page {{ pagination.current_page }} of {{ pagination.last_page }}</span>
        <div>
          <button class="button button-secondary" :disabled="page <= 1 || loading" @click="changePage(page - 1)">Previous</button>
          <button class="button button-secondary" :disabled="page >= pagination.last_page || loading" @click="changePage(page + 1)">Next</button>
        </div>
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
          <label>Confirm initial owner password<input v-model="form.owner_password_confirmation" type="password" minlength="12" autocomplete="new-password"></label>
        </div>
        <p class="page-subtitle">A new owner password must have at least 12 characters. Existing accounts keep their current password.</p>
        <div class="heading-actions">
          <button class="button button-secondary" type="button" @click="formOpen = false">Cancel</button>
          <button class="button button-primary" type="submit" :disabled="saving">{{ saving ? 'Creating…' : 'Create business' }}</button>
        </div>
      </form>
    </div>

    <div v-if="removeBusinessTarget" class="modal-backdrop" @click.self="removeBusinessTarget = null">
      <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="remove-business-title">
        <div class="panel-heading">
          <h2 id="remove-business-title">Remove {{ removeBusinessTarget.name }}?</h2>
          <button class="icon-button" type="button" aria-label="Close" @click="removeBusinessTarget = null">×</button>
        </div>
        <p class="page-subtitle">Choose what to do with this business and its owner's records.</p>
        <div class="permission-grid" role="radiogroup" aria-label="Business data removal options">
          <label class="permission-option"><input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="false"> Remove the business but keep its data (you can restore it later)</label>
          <label class="permission-option"><input v-model="removeBusinessData" type="radio" name="business-data-removal" :value="true"> Permanently delete the business and all its data</label>
        </div>
        <p v-if="removeBusinessData" class="form-error" role="alert">This permanently deletes the business's records and product images. The owner's account is deleted only if they have no other business memberships. This cannot be undone.</p>
        <div class="heading-actions">
          <button class="button button-secondary" type="button" @click="removeBusinessTarget = null">Cancel</button>
          <button class="button button-primary" type="button" :disabled="saving" @click="confirmRemoveBusiness">{{ saving ? 'Removing…' : 'Remove business' }}</button>
        </div>
      </section>
    </div>
  </main>
</template>
