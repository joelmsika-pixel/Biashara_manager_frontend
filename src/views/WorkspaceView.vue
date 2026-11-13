frontend<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  Activity, ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, ChevronDown, CircleDollarSign,
  ClipboardList, FileBarChart, LayoutDashboard, LogOut, Mail, Menu, Plus, Search, Shield,
  ShoppingBag, Users, Wallet, X,
} from '@lucide/vue'
import api from '../services/api'
import { useAuthStore } from '../stores/auth'
import bizikuaLogo from '../assets/Bizikua Business Manager Logo.png'
import ukFlag from '../assets/uk-flag.svg'
import tanzaniaFlag from '../assets/tanzania-flag.svg'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const businesses = ref(auth.user?.businesses || [])
const selectedBusinessId = ref(localStorage.getItem('business_id') || '')
const section = ref('sales')
const records = ref([])
const dashboard = ref({})
const pagination = ref(null)
const loading = ref(false)
const error = ref('')
const query = ref('')
const page = ref(1)
const modalOpen = ref(false)
const saleDetails = ref(null)
const paymentFormOpen = ref(false)
const paymentForm = ref({})
const paymentError = ref('')
const paymentSaving = ref(false)
const repaymentLoan = ref(null)
const repaymentForm = ref({})
const repaymentError = ref('')
const repaymentSaving = ref(false)
const mobileMenuOpen = ref(false)
const saving = ref(false)
const formError = ref('')
const form = ref({})
const restoringEmployee = ref(null)
const dateFrom = ref('')
const dateTo = ref('')
const reportPeriod = ref('month')
const printRecords = ref([])
let workspaceReady = false
let loadRequestId = 0

const business = computed(() => businesses.value.find((item) => String(item.id) === String(selectedBusinessId.value)))
const businessUrl = computed(() => `/businesses/${selectedBusinessId.value}`)
const membership = computed(() => business.value?.pivot || business.value?.membership)
const isOwner = computed(() => membership.value?.role === 'owner' && membership.value?.is_active)

const nav = computed(() => {
  const entries = isOwner.value
    ? [
        { key: 'dashboard', icon: LayoutDashboard },
        { key: 'income', icon: ArrowDownLeft, permission: 'income.view' },
        { key: 'expenses', icon: ArrowUpRight, permission: 'expenses.view' },
        { key: 'debts', icon: CircleDollarSign, permission: 'debts.view' },
        { key: 'sales', icon: ShoppingBag, permission: 'sales.view' },
        { key: 'reports', icon: FileBarChart, permission: 'reports.view' },
        { key: 'employees', icon: Users, permission: 'employees.view' },
        { key: 'inbox', icon: Mail },
      ]
    : [
        { key: 'income', icon: ArrowDownLeft, permission: 'income.view' },
        { key: 'expenses', icon: ArrowUpRight, permission: 'expenses.view' },
        { key: 'debts', icon: CircleDollarSign, permission: 'debts.view' },
        { key: 'sales', icon: ShoppingBag, permission: 'sales.view' },
        { key: 'inbox', icon: Mail },
      ]
  return [...entries, { key: 'logout', icon: LogOut }]
})

function can(permission) {
  const member = membership.value
  if (!member?.is_active) return false
  if (!permission) return true
  if (member.role === 'employee' && ['debts.view', 'debts.create'].includes(permission)) return true
  if (member.role === 'owner') return true
  return Array.isArray(member.permissions) && member.permissions.includes(permission)
}

const titles = {
  dashboard: 'dashboard', sales: 'sales', income: 'income', expenses: 'expenses',
  debts: 'debts', employees: 'employees', reports: 'reports', inbox: 'inbox', logout: 'logout',
}
const activeTitle = computed(() => t(titles[section.value] || 'dashboard'))
const fields = {
  sales: [
    { name: 'sale_date', label: 'date', type: 'date', required: true, autoToday: true },
    { name: 'product_name', label: 'productName', type: 'text', required: true },
    { name: 'product_price', label: 'productPrice', type: 'number', required: true, min: 0.01, step: 0.01 },
    { name: 'quantity', label: 'quantity', type: 'number', required: true, min: 0.001, step: 0.001 },
  ],
  income: [
    { name: 'income_date', label: 'date', type: 'date', required: true, autoToday: true },
    { name: 'amount', label: 'amount', type: 'number', required: true, min: 0.01, step: 0.01 },
    { name: 'description', label: 'description', type: 'text', required: true },
  ],
  expenses: [
    { name: 'expense_date', label: 'date', type: 'date', required: true, autoToday: true },
    { name: 'amount', label: 'amount', type: 'number', required: true, min: 0.01, step: 0.01 },
    { name: 'description', label: 'description', type: 'text', required: true },
  ],
  debts: [
    { name: 'loan_date', label: 'date', type: 'date', required: true, autoToday: true },
    { name: 'borrower_name', label: 'borrowerName', type: 'text', required: true },
    { name: 'principal', label: 'amount', type: 'number', required: true, min: 0.01, step: 0.01 },
    { name: 'notes', label: 'description', type: 'textarea', required: true },
  ],
  employees: [
    { name: 'name', label: 'name', type: 'text', required: true },
    { name: 'email', label: 'email', type: 'email', required: true },
    { name: 'phone', label: 'phone', type: 'tel' },
    { name: 'password', label: 'password', type: 'password', minlength: 12 },
    { name: 'password_confirmation', label: 'confirmPassword', type: 'password', minlength: 12 },
  ],
  inbox: [
    { name: 'recipient_id', label: 'recipient', type: 'select', required: true, options: [] },
    { name: 'subject', label: 'subject', type: 'text', required: true },
    { name: 'body', label: 'message', type: 'textarea', required: true },
  ],
}
const columns = computed(() => {
  const standard = {
    sales: ['sale_date', 'product_name', 'quantity', 'product_price', 'total_amount'],
    income: ['income_date', 'amount', 'description'],
    expenses: ['expense_date', 'amount', 'description'],
    debts: ['loan_date', 'borrower_name', 'principal', 'description'],
    employees: ['name', 'email', 'role', 'is_active'],
    reports: ['type', 'description', 'date', 'customer', 'category', 'amount', 'status', 'employee'],
  }
  return standard[section.value] || []
})

function labelFor(field) {
  if (typeof field === 'string') {
    if (['type', 'employee', 'paid', 'partial', 'unpaid'].includes(field)) return t(field)
    if (['sale_date', 'income_date', 'expense_date', 'payment_date'].includes(field)) return t('date')
    if (field === 'total_amount' || field === 'paid_amount' || field === 'balance') return field === 'balance' ? t('outstandingBalance') : t('amount')
    if (field === 'principal') return t('amount')
    if (field === 'product_name') return t('productName')
    if (field === 'product_price') return t('productPrice')
    if (field === 'quantity') return t('quantity')
    if (field === 'loan_type') return t('type')
    if (field === 'borrower_name') return t('borrowerName')
    if (field === 'business') return t('businessName')
    if (field === 'description') return t('description')
    if (field === 'borrower_phone') return t('phone')
    if (field === 'due_date') return t('dueDate')
    if (field === 'customer') return t('borrowerName')
    if (['category', 'is_active', 'status'].includes(field)) return t(field === 'is_active' ? 'status' : field)
    if (field === 'sale_id') return t('saleNumber')
    if (field === 'owner') return t('ownerName')
    if (field === 'record_type') return 'Record type'
    if (field === 'record_id') return 'Record'
    if (field === 'created_at') return t('date')
    if (field === 'user') return t('employee')
    return field.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  }
  return t(field.label)
}

function valueFor(row, field) {
  if (field === 'type') return reportTypeLabel(row.type)
  if (field === 'description') return row.description ?? row.notes ?? '—'
  if (field === 'product_name') return row.items?.map((item) => item.item_name).join(', ') || '—'
  if (field === 'quantity') return row.items?.map((item) => Number(item.quantity).toString()).join(', ') || '—'
  if (field === 'product_price') {
    const prices = row.items?.map((item) => formatMoney(item.unit_price))
    return prices?.join(', ') || '—'
  }
  if (field === 'loan_type') return t(row.loan_type === 'loan' ? 'businessLoan' : 'saleDebt')
  if (field === 'customer') return typeof row.customer === 'string' ? row.customer : row.customer?.name || '—'
  if (field === 'category') return typeof row.category === 'string' ? row.category : row.category?.name || row.category_name || '—'
  if (field === 'sale_number') return row.sale_number || `#${row.id}`
  if (field === 'sale_id') return row.sale?.sale_number || `#${row.sale_id}`
  if (field === 'status') return t(row.status || 'active')
  if (field === 'is_active') return row.is_active ? t('active') : t('removed')
  if (field === 'date') return formatDate(row.date)
  if (field.endsWith('_date')) return formatDate(row[field])
  if (['amount', 'principal', 'total_amount', 'paid_amount', 'balance'].includes(field)) return formatMoney(row[field])
  return row[field] ?? '—'
}

function reportTypeLabel(type) {
  const keys = { sale: 'sales', income: 'income', expense: 'expenses', payment: 'payments', debt: 'debts' }
  return t(keys[type] || type || 'type')
}

function formatMoney(value) {
  return new Intl.NumberFormat(locale.value === 'sw' ? 'sw-TZ' : 'en-TZ', {
    style: 'currency', currency: business.value?.currency || 'TZS', maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'sw' ? 'sw-TZ' : 'en-TZ', { dateStyle: 'medium' }).format(new Date(value))
}

function routeFor(key = section.value) {
  if (key === 'dashboard') return `${businessUrl.value}/dashboard`
  if (key === 'debts') return `${businessUrl.value}/debts`
  if (key === 'reports') return `${businessUrl.value}/reports`
  if (key === 'employees') return `${businessUrl.value}/employees`
  if (key === 'inbox') return `${businessUrl.value}/inbox`
  return `${businessUrl.value}/${key}`
}

async function load() {
  const requestId = ++loadRequestId
  if (!auth.user) {
    loading.value = false
    return
  }
  if (!selectedBusinessId.value) {
    const firstBusinessId = String(businesses.value[0]?.id || '')
    if (firstBusinessId) selectedBusinessId.value = firstBusinessId
    loading.value = false
    return
  }
  if (!isOwner.value && ['dashboard', 'reports', 'employees'].includes(section.value)) {
    error.value = t('forbidden')
    records.value = []
    pagination.value = null
    loading.value = false
    return
  }
  if (!['dashboard', 'debts', 'reports', 'inbox'].includes(section.value) && !can(`${section.value}.view`)) {
    error.value = t('forbidden')
    records.value = []
    pagination.value = null
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    if (section.value === 'dashboard' && isOwner.value) {
      const { data } = await api.get(routeFor())
      if (requestId !== loadRequestId) return
      dashboard.value = data
      records.value = data.recent_activity || data.recent_sales || []
      return
    }
    if (section.value === 'reports') {
      const { data } = await api.get(routeFor(), { params: {
        from: dateFrom.value || undefined,
        to: dateTo.value || undefined,
        search: query.value || undefined,
        page: page.value,
        per_page: 15,
      } })
      if (requestId !== loadRequestId) return
      dashboard.value = data
      records.value = data.records?.data || []
      pagination.value = data.records?.meta || data.records || null
      return
    }
    const params = { page: page.value, per_page: 15, search: query.value || undefined }
    const { data } = await api.get(routeFor(), { params })
    if (requestId !== loadRequestId) return
    records.value = data.data || (Array.isArray(data) ? data : [])
    pagination.value = data.meta || (data.current_page ? data : null)
  } catch (requestError) {
    if (requestId === loadRequestId) {
      error.value = requestError.response?.status === 403 ? t('forbidden') : requestError.response?.data?.message || t('errorGeneric')
      records.value = []
    }
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

async function loadBusinesses() {
  if (!auth.user) return
  businesses.value = auth.user.businesses || []
  if (!businesses.value.some((item) => String(item.id) === String(selectedBusinessId.value))) {
    selectedBusinessId.value = String(businesses.value[0]?.id || '')
  }
  if (selectedBusinessId.value) localStorage.setItem('business_id', selectedBusinessId.value)
  else localStorage.removeItem('business_id')
}

async function openForm() {
  formError.value = ''
  restoringEmployee.value = null
  form.value = Object.fromEntries(
    (fields[section.value] || [])
      .filter((field) => field.autoToday)
      .map((field) => [field.name, localToday()]),
  )
  if (section.value === 'inbox') {
    try {
      const { data } = await api.get(`${businessUrl.value}/employees`, { params: { per_page: 100 } })
      fields.inbox[0].options = (data.data || data)
        .filter((employee) => employee.is_active)
        .map((employee) => ({ value: employee.id, label: employee.name }))
    } catch (requestError) {
      formError.value = requestError.response?.data?.message || t('errorGeneric')
    }
  }
  modalOpen.value = true
}

function openEmployeeRestore(employee) {
  formError.value = ''
  restoringEmployee.value = employee
  form.value = {
    name: employee.name,
    email: employee.restore_email || '',
    phone: employee.phone || '',
    password: '',
    password_confirmation: '',
  }
  modalOpen.value = true
}

function localToday() {
  const today = new Date()
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-')
}

async function submitForm() {
  formError.value = ''
  saving.value = true
  try {
    if (section.value === 'employees') {
      if (restoringEmployee.value) {
        await api.patch(`${businessUrl.value}/employees/${restoringEmployee.value.id}`, {
          ...form.value,
          is_active: true,
        })
      } else {
        await api.post(`${businessUrl.value}/employees`, form.value)
      }
    } else if (section.value === 'inbox') {
      await api.post(`${businessUrl.value}/inbox`, form.value)
    } else if (section.value === 'debts') {
      const { principal, ...loanForm } = form.value
      await api.post(`${businessUrl.value}/loans`, { ...loanForm, principal })
    } else if (section.value === 'sales') {
      const payload = {
        sale_date: form.value.sale_date,
        is_completed: true,
        items: [{
          item_name: form.value.product_name,
          quantity: form.value.quantity,
          unit_price: form.value.product_price,
        }],
      }
      await api.post(`${businessUrl.value}/sales`, payload)
    } else {
      await api.post(routeFor(), form.value)
    }
    form.value = {}
    restoringEmployee.value = null
    modalOpen.value = false
    query.value = ''
    page.value = 1
    await load()
  } catch (requestError) {
    formError.value = requestError.response?.data?.message || Object.values(requestError.response?.data?.errors || {}).flat()[0] || t('errorGeneric')
  } finally {
    saving.value = false
  }
}

async function showSale(record) {
  try {
    const { data } = await api.get(`${businessUrl.value}/sales/${record.id}`)
    saleDetails.value = data
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('errorGeneric')
  }
}

function openPaymentForm() {
  paymentForm.value = {
    amount: '',
    payment_date: localToday(),
    payment_method: '',
    reference: '',
  }
  paymentError.value = ''
  paymentFormOpen.value = true
}

async function submitPayment() {
  paymentError.value = ''
  paymentSaving.value = true
  try {
    await api.post(`${businessUrl.value}/sales/${saleDetails.value.id}/payments`, paymentForm.value)
    paymentFormOpen.value = false
    await showSale(saleDetails.value)
    await load()
  } catch (requestError) {
    paymentError.value = requestError.response?.data?.message || Object.values(requestError.response?.data?.errors || {}).flat()[0] || t('errorGeneric')
  } finally {
    paymentSaving.value = false
  }
}

function openLoanRepayment(loan) {
  repaymentLoan.value = loan
  repaymentForm.value = {
    amount: loan.balance,
    payment_date: localToday(),
    destination: '',
  }
  repaymentError.value = ''
}

async function submitLoanRepayment() {
  repaymentError.value = ''
  repaymentSaving.value = true
  try {
    await api.post(`${businessUrl.value}/loans/${repaymentLoan.value.loan_id}/repayments`, repaymentForm.value)
    repaymentLoan.value = null
    await load()
  } catch (requestError) {
    repaymentError.value = requestError.response?.data?.message || Object.values(requestError.response?.data?.errors || {}).flat()[0] || t('errorGeneric')
  } finally {
    repaymentSaving.value = false
  }
}

async function updateEmployee(employee) {
  if (!employee.is_active) return
  try {
    await api.patch(`${businessUrl.value}/employees/${employee.id}`, { is_active: false })
    await load()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('errorGeneric')
  }
}

async function markMessageRead(message) {
  try {
    await api.patch(`${businessUrl.value}/inbox/${message.id}/read`)
    await load()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('errorGeneric')
  }
}

async function logout() {
  try {
    await auth.logout()
  } finally {
    await router.push({ name: 'login' })
  }
}

function switchLanguage() {
  locale.value = locale.value === 'en' ? 'sw' : 'en'
  localStorage.setItem('language', locale.value)
}

function changeReportPeriod(period) {
  reportPeriod.value = period
  const end = new Date()
  const start = new Date(end)
  if (period === 'week') {
    start.setDate(end.getDate() - ((end.getDay() + 6) % 7))
  } else if (period === 'month') {
    start.setDate(1)
  } else {
    start.setMonth(0, 1)
  }
  const formatLocalDate = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  dateFrom.value = formatLocalDate(start)
  dateTo.value = formatLocalDate(end)
  page.value = 1
}

async function printReport() {
  const reportRows = []
  let currentPage = 1
  let lastPage = 1
  try {
    do {
      const { data } = await api.get(routeFor('reports'), { params: {
        from: dateFrom.value || undefined,
        to: dateTo.value || undefined,
        search: query.value || undefined,
        page: currentPage,
        per_page: 100,
      } })
      reportRows.push(...(data.records?.data || []))
      lastPage = data.records?.last_page || 1
      currentPage += 1
    } while (currentPage <= lastPage)
    printRecords.value = reportRows
    await nextTick()
    window.print()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('errorGeneric')
  }
}

function selectSection(key) {
  if (key === 'logout') {
    logout()
    return
  }
  const needsReload = section.value === key && !query.value && page.value === 1
  section.value = key
  query.value = ''
  page.value = 1
  mobileMenuOpen.value = false
  if (needsReload) load()
}

watch([section, selectedBusinessId, query, page, dateFrom, dateTo], () => {
  if (selectedBusinessId.value) localStorage.setItem('business_id', selectedBusinessId.value)
  else localStorage.removeItem('business_id')
  if (!workspaceReady) return
  if (!isOwner.value && ['dashboard', 'reports', 'employees'].includes(section.value)) {
    section.value = 'sales'
    page.value = 1
    query.value = ''
    return
  }
  load()
})
watch(query, () => { page.value = 1 })

onMounted(async () => {
  try {
    await loadBusinesses()
    if (isOwner.value) section.value = 'dashboard'
    changeReportPeriod('month')
    await nextTick()
    workspaceReady = true
    await load()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('notConfigured')
  }
})
</script>

<template>
  <div class="workspace">
    <div v-if="mobileMenuOpen" class="mobile-overlay" @click="mobileMenuOpen = false"></div>
    <aside class="sidebar" :class="{ 'sidebar-open': mobileMenuOpen }">
      <div class="sidebar-brand">
        <img class="sidebar-logo" :src="bizikuaLogo" alt="Bizikua Business Manager" />
        <button class="icon-button mobile-close" :aria-label="t('cancel')" @click="mobileMenuOpen = false"><X :size="19" /></button>
      </div>
      <div v-if="businesses.length" class="business-switcher">
        <span>{{ t('businessSelector') }}</span>
        <div class="select-wrap"><BriefcaseBusiness :size="15" /><select v-model="selectedBusinessId" :aria-label="t('businessSelector')">
          <option v-for="item in businesses" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
        </select><ChevronDown :size="14" /></div>
      </div>
      <div class="nav-caption">{{ t('businessRecords') }}</div>
      <nav class="side-nav">
        <button v-for="item in nav.filter((entry) => can(entry.permission))" :key="item.key" class="nav-item" :class="{ 'nav-item-active': section === item.key }" @click="selectSection(item.key)">
          <component :is="item.icon" :size="18" stroke-width="1.8" />
          <span>{{ t(item.key) }}</span>
          <span v-if="item.key === 'debts' && dashboard.debt_count" class="nav-count">{{ dashboard.debt_count }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="record-only-chip"><Shield :size="15" /><span>{{ t('recordOnly') }}</span></div>
        <div class="profile-row"><div class="avatar">{{ auth.user?.name?.slice(0, 1)?.toUpperCase() || 'U' }}</div><div class="profile-meta"><strong>{{ auth.user?.name }}</strong><span>{{ membership?.role || t('member') }}</span></div></div>
      </div>
    </aside>

    <main class="main-panel">
      <header class="topbar">
        <button class="icon-button mobile-menu" :aria-label="t('brand')" @click="mobileMenuOpen = true"><Menu :size="20" /></button>
        <div class="breadcrumbs"><span>{{ t('brand') }}</span><span class="crumb-separator">/</span><strong>{{ activeTitle }}</strong></div>
        <div class="topbar-actions">
          <button
            class="language-button"
            type="button"
            :aria-label="`${t('language')}: ${locale === 'en' ? t('english') : t('swahili')}`"
            :title="locale === 'en' ? t('english') : t('swahili')"
            @click="switchLanguage"
          >
            <img class="language-flag" :src="locale === 'en' ? ukFlag : tanzaniaFlag" alt="" />
          </button>
          <div class="topbar-divider"></div>
          <div class="topbar-user"><div class="avatar tiny">{{ auth.user?.name?.slice(0, 1)?.toUpperCase() || 'U' }}</div><span>{{ auth.user?.name }}</span></div>
        </div>
      </header>

      <div class="content">
        <section class="page-heading">
          <div><p class="eyebrow">{{ business?.name || t('brand') }}</p><h1>{{ activeTitle }}</h1>
            <p v-if="section === 'sales'" class="page-subtitle">{{ t('salesNote') }}</p>
            <p v-else-if="section === 'income'" class="page-subtitle">{{ t('incomeNote') }}</p>
            <p v-else-if="section === 'debts'" class="page-subtitle">{{ t('debtNote') }}</p>
            <p v-else-if="section === 'reports' && isOwner" class="page-subtitle">{{ formatDate(dateFrom) }} – {{ formatDate(dateTo) }}</p>
            <p v-else-if="section === 'dashboard' && isOwner" class="page-subtitle">{{ t('tagline') }}</p>
          </div>
          <div class="heading-actions">
            <button v-if="section === 'reports' && isOwner" class="button button-primary" @click="printReport"><FileBarChart :size="17" />{{ t('printReport') }}</button>
            <button v-if="['sales','income','expenses'].includes(section) && can(`${section}.create`)" class="button button-primary" @click="openForm"><Plus :size="17" />{{ t('newRecord') }}</button>
            <button v-if="section === 'debts' && can('debts.create')" class="button button-primary" @click="openForm"><Plus :size="17" />{{ t('recordLoan') }}</button>
            <button v-if="section === 'employees' && isOwner" class="button button-primary" @click="openForm"><Plus :size="17" />{{ t('addEmployee') }}</button>
            <button v-if="section === 'inbox' && isOwner" class="button button-primary" @click="openForm"><Plus :size="17" />{{ t('newMessage') }}</button>
          </div>
        </section>

        <div v-if="section === 'dashboard' && isOwner" class="notice-banner"><div class="notice-icon"><Shield :size="17" /></div><div><strong>{{ t('recordOnly') }}</strong><p>{{ t('recordOnlyHint') }}</p></div></div>

        <div v-if="section === 'dashboard' && isOwner" class="summary-grid">
          <article class="summary-card"><div class="summary-heading"><span>{{ t('recordedSales') }}</span><span class="metric-icon green"><ShoppingBag :size="17" /></span></div><strong>{{ formatMoney(dashboard.sales_total) }}</strong><div class="metric-foot"><span class="metric-label">{{ t('salesDescription') }}</span></div><div class="sparkline green-line"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('otherIncome') }}</span><span class="metric-icon blue"><ArrowDownLeft :size="17" /></span></div><strong>{{ formatMoney(dashboard.income_total) }}</strong><div class="metric-foot"><span class="metric-label">{{ t('incomeDescription') }}</span></div><div class="sparkline blue-line"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('recordedExpenses') }}</span><span class="metric-icon orange"><ArrowUpRight :size="17" /></span></div><strong>{{ formatMoney(dashboard.expenses_total) }}</strong><div class="metric-foot"><span class="metric-label">{{ t('expensesDescription') }}</span></div><div class="sparkline orange-line"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('outstandingBalance') }}</span><span class="metric-icon purple"><Wallet :size="17" /></span></div><strong>{{ formatMoney(dashboard.outstanding_total) }}</strong><div class="metric-foot"><span class="metric-label">{{ dashboard.debt_count || 0 }} {{ t('debts').toLowerCase() }}</span></div><div class="sparkline purple-line"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
        </div>

        <div v-if="section === 'reports' && isOwner" class="summary-grid report-grid">
          <article class="summary-card"><div class="summary-heading"><span>{{ t('otherIncome') }}</span><ArrowDownLeft :size="17" /></div><strong>{{ formatMoney(dashboard.income_total) }}</strong></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('recordedExpenses') }}</span><ArrowUpRight :size="17" /></div><strong>{{ formatMoney(dashboard.expenses_total) }}</strong></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('recordedSales') }}</span><ShoppingBag :size="17" /></div><strong>{{ formatMoney(dashboard.sales_total) }}</strong></article>
          <article class="summary-card"><div class="summary-heading"><span>{{ t('debts') }}</span><Wallet :size="17" /></div><strong>{{ formatMoney(dashboard.debts_total) }}</strong></article>
          <article class="summary-card report-general-total"><div class="summary-heading"><span>{{ t('generalTotal') }}</span></div><strong>{{ formatMoney(dashboard.general_total) }}</strong></article>
        </div>

        <section v-if="section === 'dashboard' && isOwner" class="panel-card activity-card">
          <div class="panel-heading"><div class="card-title-row"><div class="section-icon"><Activity :size="18" /></div><div><h2>{{ t('recentActivity') }}</h2><p>{{ t('latestTeamActivity') }}</p></div></div></div>
          <div v-if="loading" class="state-message">{{ t('loading') }}</div>
          <div v-else-if="records.length" class="table-wrap"><table><thead><tr><th>{{ t('description') }}</th><th>{{ t('customer') }}</th><th>{{ t('date') }}</th><th>{{ t('amount') }}</th><th>{{ t('status') }}</th></tr></thead><tbody><tr v-for="row in records" :key="`${row.type || 'sale'}-${row.id}`"><td><div class="activity-name"><span class="activity-dot" :class="row.type || 'sale'"><component :is="row.type === 'expense' ? ArrowUpRight : row.type === 'income' ? ArrowDownLeft : ShoppingBag" :size="15" /></span><span>{{ row.description || row.sale_number || row.source || t('sales') }}</span></div></td><td>{{ row.customer?.name || '—' }}</td><td>{{ formatDate(row.sale_date || row.income_date || row.expense_date || row.created_at) }}</td><td class="amount-cell">{{ formatMoney(row.total_amount || row.amount) }}</td><td><span class="status-badge">{{ row.status || t('active') }}</span></td></tr></tbody></table></div>
          <div v-else class="state-message"><ClipboardList :size="25" /><span>{{ t('empty') }}</span></div>
          <p v-if="error" class="form-error">{{ error }}</p>
        </section>

        <section v-if="section === 'inbox'" class="inbox-list">
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <div v-if="loading" class="state-message">{{ t('loading') }}</div>
          <article v-else-if="records.length" v-for="message in records" :key="message.id" class="inbox-message" :class="{ unread: !message.read_at && message.recipient_id === auth.user?.id }">
            <div class="inbox-message-heading"><div><h2>{{ message.subject }}</h2><p>{{ message.sender?.name }} · {{ formatDate(message.created_at) }}</p></div><button v-if="message.recipient_id === auth.user?.id && !message.read_at" class="text-action" @click="markMessageRead(message)">{{ t('markRead') }}</button></div>
            <p class="inbox-message-body">{{ message.body }}</p>
            <span v-if="message.recipient_id !== auth.user?.id" class="message-direction">{{ t('sent') }} · {{ message.recipient?.name }}</span>
          </article>
          <div v-else-if="!loading && !error" class="state-message"><Mail :size="25" /><span>{{ t('emptyInbox') }}</span></div>
        </section>

        <section v-if="section !== 'dashboard' && section !== 'inbox'" class="panel-card">
          <div v-if="['sales', 'income', 'expenses', 'debts', 'reports'].includes(section)" class="table-toolbar">
            <div v-if="['sales', 'income', 'expenses', 'debts', 'reports'].includes(section)" class="search-box"><Search :size="17" /><input v-model="query" :placeholder="t('search')" /></div>
            <div v-if="section === 'reports'" class="report-periods" role="group" :aria-label="t('reportPeriod')">
              <button v-for="period in ['week', 'month', 'year']" :key="period" class="button" :class="reportPeriod === period ? 'button-primary' : 'button-secondary'" @click="changeReportPeriod(period)">{{ t(period) }}</button>
            </div>
          </div>
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <div v-if="loading" class="state-message">{{ t('loading') }}</div>
          <div v-else-if="records.length && columns.length" class="table-wrap"><table><thead><tr><th v-for="column in columns" :key="column">{{ labelFor(column) }}</th><th v-if="section !== 'sales' && section !== 'reports'" class="actions-column">{{ t('actions') }}</th></tr></thead><tbody><tr v-for="row in records" :key="row.id"><td v-for="column in columns" :key="column" :class="{ 'amount-cell': ['amount', 'total_amount', 'paid_amount', 'balance'].includes(column) }">{{ valueFor(row, column) }}</td><td v-if="section !== 'sales' && section !== 'reports'" class="row-actions actions-column">
            <template v-if="section === 'employees'"><button v-if="row.is_active" class="text-action" @click="updateEmployee(row)">{{ t('removeEmployee') }}</button><button v-else class="text-action" @click="openEmployeeRestore(row)">{{ t('restoreEmployee') }}</button></template>
            <template v-else-if="section === 'debts' && row.loan_type === 'loan'"><button v-if="can('debts.create') && Number(row.balance) > 0" class="text-action" @click="openLoanRepayment(row)">{{ t('markAsPaid') }}</button><span v-else>{{ t('paid') }}</span></template>
            <button v-else-if="section === 'sales'" class="text-action" @click="showSale(row)">{{ t('viewDetails') }}</button>
            <span v-else>—</span></td></tr></tbody></table></div>
          <div v-else-if="!loading && !error" class="state-message"><ClipboardList :size="25" /><span>{{ t('empty') }}</span></div>
          <div v-if="pagination && pagination.last_page > 1" class="pagination"><span>{{ t('page') }} {{ pagination.current_page }} {{ t('of') }} {{ pagination.last_page }}</span><div><button class="button button-secondary" :disabled="page <= 1" @click="page--">{{ t('previous') }}</button><button class="button button-secondary" :disabled="page >= pagination.last_page" @click="page++">{{ t('next') }}</button></div></div>
        </section>
        <p v-if="section === 'dashboard' && isOwner" class="profit-disclaimer">{{ t('noProfit') }}</p>
      </div>
    </main>

    <section class="print-report" aria-hidden="true">
      <header class="print-header">
        <div class="print-brand">
          <img class="print-brand-logo" :src="bizikuaLogo" alt="Bizikua Business Manager" />
          <div>
            <h1>{{ business?.name || t('businessName') }}</h1>
            <p v-if="business?.business_type" class="print-business-type">{{ business.business_type }}</p>
          </div>
        </div>
        <div class="print-heading-meta">
          <h2>{{ t('reportTitle') }}</h2>
          <span>{{ t(reportPeriod) }} {{ t('reportPeriod').toLowerCase() }}</span>
          <strong>{{ formatDate(dateFrom) }} – {{ formatDate(dateTo) }}</strong>
        </div>
      </header>
      <div class="print-rule"></div>
      <div class="print-summary-heading">
        <h3>{{ t('financialSummary') }}</h3>
        <span>{{ t('currency') }}: {{ business?.currency || 'TZS' }}</span>
      </div>
      <table class="print-summary">
        <tbody>
          <tr><th><span class="print-dot income-dot"></span>{{ t('otherIncome') }}</th><td>{{ formatMoney(dashboard.income_total) }}</td></tr>
          <tr><th><span class="print-dot expense-dot"></span>{{ t('recordedExpenses') }}</th><td>{{ formatMoney(dashboard.expenses_total) }}</td></tr>
          <tr><th><span class="print-dot sales-dot"></span>{{ t('recordedSales') }}</th><td>{{ formatMoney(dashboard.sales_total) }}</td></tr>
          <tr><th><span class="print-dot debt-dot"></span>{{ t('debts') }}</th><td>{{ formatMoney(dashboard.debts_total) }}</td></tr>
          <tr class="print-total-row"><th>{{ t('generalTotal') }}</th><td>{{ formatMoney(dashboard.general_total) }}</td></tr>
        </tbody>
      </table>
      <div class="print-ledger-heading">
        <div><h3>{{ t('reportDetails') }}</h3><p>{{ printRecords.length }} {{ t('records') }}</p></div>
      </div>
      <table class="print-records">
        <thead><tr><th class="print-col-number">#</th><th>{{ t('type') }}</th><th>{{ t('description') }}</th><th>{{ t('date') }}</th><th>{{ t('status') }}</th><th class="print-col-amount">{{ t('amount') }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in printRecords" :key="`${row.type}-${row.id}`">
            <td class="print-col-number">{{ index + 1 }}</td>
            <td><span class="print-type">{{ reportTypeLabel(row.type) }}</span></td>
            <td>{{ row.description || row.customer || '—' }}</td>
            <td>{{ formatDate(row.date) }}</td>
            <td>{{ t(row.status || 'recorded') }}</td>
            <td class="print-col-amount">{{ formatMoney(row.amount) }}</td>
          </tr>
          <tr v-if="!printRecords.length"><td colspan="6" class="print-empty">{{ t('empty') }}</td></tr>
        </tbody>
      </table>
      <footer class="print-footer">
        <span>{{ t('reportGenerated') }} {{ formatDate(localToday()) }}</span>
        <span>{{ t('recordOnly') }} · {{ t('page') }} <span class="print-page-number"></span></span>
      </footer>
    </section>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="modalOpen = false">
      <form class="modal-card" @submit.prevent="submitForm">
        <div class="modal-heading"><div><p class="eyebrow">{{ business?.name || t('brand') }}</p><h2>{{ section === 'inbox' ? t('newMessage') : section === 'employees' ? restoringEmployee ? t('restoreEmployee') : t('addEmployee') : section === 'debts' ? t('recordLoan') : t('newRecord') }}</h2></div><button class="icon-button" type="button" :aria-label="t('cancel')" @click="modalOpen = false; restoringEmployee = null"><X :size="19" /></button></div>
        <p v-if="section === 'debts'" class="inline-note">{{ t('recordLoanHint') }}</p>
        <p v-if="section === 'employees'" class="inline-note">{{ restoringEmployee ? t('employeeRestoreHint') : t('employeePasswordHint') }}</p>
        <div class="form-grid">
          <label v-for="field in fields[section]" :key="field.name" :class="{ 'form-span': field.type === 'textarea' }">
            {{ t(field.label) }}<span v-if="field.required" class="required-mark"> *</span>
            <select v-if="field.type === 'select'" v-model="form[field.name]" :required="field.required">
              <option value="">—</option>
              <option v-for="option in field.options" :key="typeof option === 'string' ? option : option.value" :value="typeof option === 'string' ? option : option.value">{{ typeof option === 'string' ? option : option.label }}</option>
            </select>
            <input v-else-if="field.type === 'display'" :value="business?.name || ''" readonly />
            <textarea v-else-if="field.type === 'textarea'" v-model="form[field.name]" rows="3" :required="field.required"></textarea>
            <input v-else v-model="form[field.name]" :type="field.type" :required="field.required || (restoringEmployee && ['password', 'password_confirmation'].includes(field.name))" :min="field.min" :step="field.step" :minlength="field.minlength" :disabled="field.autoToday" :autocomplete="field.type === 'password' ? 'new-password' : undefined" />
          </label>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <p v-if="section === 'sales'" class="inline-note">{{ t('completedSaleNote') }}</p>
        <div class="modal-actions"><button class="button button-secondary" type="button" @click="modalOpen = false">{{ t('cancel') }}</button><button class="button button-primary" :disabled="saving">{{ saving ? t('loading') : t('save') }}</button></div>
      </form>
    </div>
    <div v-if="saleDetails" class="modal-backdrop" @click.self="saleDetails = null; paymentFormOpen = false">
      <section class="modal-card detail-card">
        <div class="modal-heading"><div><p class="eyebrow">{{ business?.name }}</p><h2>{{ saleDetails.sale_number }}</h2></div><button class="icon-button" :aria-label="t('cancel')" @click="saleDetails = null; paymentFormOpen = false"><X :size="19" /></button></div>
        <p class="inline-note">{{ t('salesNote') }}</p>
        <div class="detail-summary"><span>{{ t('businessName') }}<strong>{{ business?.name || '—' }}</strong></span><span>{{ t('date') }}<strong>{{ formatDate(saleDetails.sale_date) }}</strong></span><span>{{ t('amount') }}<strong>{{ formatMoney(saleDetails.total_amount) }}</strong></span><span>{{ t('status') }}<strong>{{ t(saleDetails.status) }}</strong></span></div>
        <h3>{{ t('items') }}</h3><div v-for="item in saleDetails.items" :key="item.id" class="detail-row"><span>{{ item.item_name }} × {{ item.quantity }}</span><strong>{{ formatMoney(item.line_total) }}</strong></div>
        <h3>{{ t('payments') }}</h3><p class="page-subtitle">{{ t('paymentNote') }}</p><div v-if="saleDetails.payments.length"><div v-for="payment in saleDetails.payments" :key="payment.id" class="detail-row"><span>{{ formatDate(payment.payment_date) }} · {{ payment.payment_method }}</span><strong>{{ formatMoney(payment.amount) }}</strong></div></div><p v-else class="state-message">{{ t('empty') }}</p>
        <button v-if="can('payments.create') && Number(saleDetails.balance) > 0" class="button button-primary payment-add" @click="openPaymentForm">{{ t('recordPayment') }}</button>
        <form v-if="paymentFormOpen" class="payment-entry" @submit.prevent="submitPayment">
          <label>{{ t('amount') }}<input v-model="paymentForm.amount" type="number" min="0.01" step="0.01" required /></label>
          <label>{{ t('date') }}<input v-model="paymentForm.payment_date" type="date" required disabled /></label>
          <label>{{ t('paymentMethod') }}<input v-model="paymentForm.payment_method" required /></label>
          <label>{{ t('reference') }}<input v-model="paymentForm.reference" /></label>
          <p v-if="paymentError" class="form-error" role="alert">{{ paymentError }}</p>
          <button type="button" class="button button-secondary" @click="paymentFormOpen = false">{{ t('cancel') }}</button>
          <button class="button button-primary" :disabled="paymentSaving">{{ paymentSaving ? t('loading') : t('save') }}</button>
        </form>
      </section>
    </div>
    <div v-if="repaymentLoan" class="modal-backdrop" @click.self="repaymentLoan = null">
      <form class="modal-card" @submit.prevent="submitLoanRepayment">
        <div class="modal-heading"><div><p class="eyebrow">{{ t('businessLoan') }}</p><h2>{{ repaymentLoan.borrower_name }}</h2></div><button class="icon-button" type="button" :aria-label="t('cancel')" @click="repaymentLoan = null"><X :size="19" /></button></div>
        <p class="inline-note">{{ t('loanBalance') }}: {{ formatMoney(repaymentLoan.balance) }}</p>
        <div class="form-grid">
          <label>{{ t('amount') }}<input v-model="repaymentForm.amount" type="number" min="0.01" :max="repaymentLoan.balance" step="0.01" required readonly /></label>
          <label>{{ t('date') }}<input v-model="repaymentForm.payment_date" type="date" required disabled /></label>
          <label class="form-span">{{ t('paymentDestination') }}<select v-model="repaymentForm.destination" required><option value="">—</option><option v-for="destination in ['income', 'expenses', 'sales']" :key="destination" :value="destination">{{ t(destination) }}</option></select></label>
        </div>
        <p v-if="repaymentError" class="form-error" role="alert">{{ repaymentError }}</p>
        <div class="modal-actions"><button class="button button-secondary" type="button" @click="repaymentLoan = null">{{ t('cancel') }}</button><button class="button button-primary" :disabled="repaymentSaving">{{ repaymentSaving ? t('loading') : t('markAsPaid') }}</button></div>
      </form>
    </div>
  </div>
</template>
