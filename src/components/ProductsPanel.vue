<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus, Package, Pencil, Plus, Search, Trash2, Upload, X } from '@lucide/vue'
import api from '../services/api'

const props = defineProps({
  businessUrl: { type: String, required: true },
  currency: { type: String, default: 'TZS' },
  canCreate: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
})

const { t } = useI18n()
const products = ref([])
const categories = ref([])
const pagination = ref(null)
const search = ref('')
const categoryFilter = ref('')
const stockFilter = ref('all')
const page = ref(1)
const loading = ref(false)
const error = ref('')
const cleanupWarning = ref('')
const modalOpen = ref(false)
const editingProduct = ref(null)
const saving = ref(false)
const uploadProgress = ref(0)
const formError = ref('')
const selectedFiles = ref([])
const retainedImages = ref([])
const form = ref(blankForm())
const fileInput = ref(null)
let requestId = 0
let searchTimer

function blankForm() {
  return {
    name: '',
    description: '',
    selling_price: '',
    cost_price: '',
    sku: '',
    category: '',
    stock_quantity: '0',
  }
}

function objectUrl(file) {
  return URL.createObjectURL(file)
}

function releaseSelectedFiles() {
  selectedFiles.value.forEach((item) => URL.revokeObjectURL(item.preview))
  selectedFiles.value = []
}

function validateFiles(files) {
  const allowedExtensions = /\.(jpe?g|png|webp|svg)$/i
  for (const file of files) {
    if (!allowedExtensions.test(file.name)) {
      return t('productFileFormatError')
    }
    const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml'
    if (file.size > (isSvg ? 2 : 8) * 1024 * 1024) {
      return isSvg ? t('productSvgSizeError') : t('productRasterSizeError')
    }
  }
  if (retainedImages.value.length + selectedFiles.value.length + files.length > 5) {
    return t('productImageCountError')
  }
  const totalBytes = [...selectedFiles.value.map((item) => item.file), ...files]
    .reduce((total, file) => total + file.size, 0)
  if (totalBytes > 40 * 1024 * 1024) return t('productCombinedSizeError')
  return ''
}

function addFiles(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return
  const validationError = validateFiles(files)
  if (validationError) {
    formError.value = validationError
    event.target.value = ''
    return
  }
  formError.value = ''
  selectedFiles.value.push(...files.map((file) => ({ file, preview: objectUrl(file) })))
  event.target.value = ''
}

function removeSelectedFile(index) {
  const [removed] = selectedFiles.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.preview)
}

async function loadProducts() {
  const currentRequest = ++requestId
  if (!props.businessUrl) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get(`${props.businessUrl}/products`, {
      params: {
        search: search.value.trim() || undefined,
        category: categoryFilter.value || undefined,
        stock_status: stockFilter.value,
        page: page.value,
        per_page: 12,
      },
    })
    if (currentRequest !== requestId) return
    products.value = data.data || []
    categories.value = data.categories || []
    pagination.value = data.meta || null
  } catch (requestError) {
    if (currentRequest !== requestId) return
    error.value = requestError.response?.status === 403
      ? t('forbidden')
      : requestError.response?.data?.message || t('errorGeneric')
    products.value = []
    pagination.value = null
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function openCreate() {
  editingProduct.value = null
  form.value = blankForm()
  retainedImages.value = []
  releaseSelectedFiles()
  formError.value = ''
  uploadProgress.value = 0
  modalOpen.value = true
}

function openEdit(product) {
  editingProduct.value = product
  form.value = {
    name: product.name || '',
    description: product.description || '',
    selling_price: String(product.selling_price ?? ''),
    cost_price: product.cost_price === null ? '' : String(product.cost_price ?? ''),
    sku: product.sku || '',
    category: product.category || '',
    stock_quantity: String(product.stock_quantity ?? '0'),
  }
  retainedImages.value = [...(product.images || [])]
  releaseSelectedFiles()
  formError.value = ''
  uploadProgress.value = 0
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  modalOpen.value = false
  releaseSelectedFiles()
  retainedImages.value = []
}

async function saveProduct() {
  formError.value = ''
  saving.value = true
  uploadProgress.value = 0
  const payload = new FormData()
  Object.entries(form.value).forEach(([key, value]) => payload.append(key, value ?? ''))
  if (editingProduct.value) {
    payload.append('keep_image_ids', JSON.stringify(retainedImages.value.map((image) => image.id)))
  }
  selectedFiles.value.forEach(({ file }) => payload.append('images', file))

  try {
    const request = editingProduct.value
      ? api.patch(`${props.businessUrl}/products/${editingProduct.value.id}`, payload, {
          onUploadProgress: updateUploadProgress,
        })
      : api.post(`${props.businessUrl}/products`, payload, {
          onUploadProgress: updateUploadProgress,
        })
    await request
    modalOpen.value = false
    releaseSelectedFiles()
    retainedImages.value = []
    await loadProducts()
  } catch (requestError) {
    formError.value = requestError.response?.data?.message
      || Object.values(requestError.response?.data?.errors || {}).flat()[0]
      || t('errorGeneric')
  } finally {
    saving.value = false
  }
}

function updateUploadProgress(event) {
  if (!event.total) return
  uploadProgress.value = Math.min(100, Math.round((event.loaded / event.total) * 100))
}

async function deleteProduct(product) {
  if (!window.confirm(t('productDeleteConfirm', { name: product.name }))) return
  error.value = ''
  cleanupWarning.value = ''
  try {
    const { data } = await api.delete(`${props.businessUrl}/products/${product.id}`)
    if (products.value.length === 1 && page.value > 1) page.value -= 1
    else await loadProducts()
    if (data.cleanup_pending) cleanupWarning.value = data.warning || t('productCleanupPending')
  } catch (requestError) {
    error.value = requestError.response?.data?.message || t('errorGeneric')
  }
}

function formatPrice(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: props.currency || 'TZS',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

watch(
  [() => props.businessUrl, search, categoryFilter, stockFilter, page],
  () => {
    clearTimeout(searchTimer)
    searchTimer = setTimeout(loadProducts, 250)
  },
)

watch(() => props.businessUrl, () => {
  page.value = 1
  search.value = ''
  categoryFilter.value = ''
  stockFilter.value = 'all'
  cleanupWarning.value = ''
})

watch(search, () => {
  page.value = 1
})

watch([categoryFilter, stockFilter], () => {
  page.value = 1
})

onMounted(loadProducts)
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  releaseSelectedFiles()
})
</script>

<template>
  <section class="products-panel">
    <div class="products-toolbar">
      <label class="search-box products-search">
        <Search :size="17" />
        <input v-model="search" :placeholder="t('productsSearch')" :aria-label="t('productsSearch')" />
      </label>
      <select v-model="categoryFilter" class="products-filter" :aria-label="t('category')">
        <option value="">{{ t('allCategories') }}</option>
        <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
      </select>
      <select v-model="stockFilter" class="products-filter" :aria-label="t('productStockFilter')">
        <option value="all">{{ t('allStock') }}</option>
        <option value="in-stock">{{ t('inStock') }}</option>
        <option value="out-of-stock">{{ t('outOfStock') }}</option>
      </select>
      <button v-if="canCreate" class="button button-primary products-add" type="button" @click="openCreate">
        <Plus :size="17" />{{ t('addProduct') }}
      </button>
    </div>

    <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
    <p v-if="cleanupWarning" class="inline-note" role="status">{{ cleanupWarning }}</p>
    <div v-if="loading" class="state-message">{{ t('loadingProducts') }}</div>
    <div v-else-if="products.length" class="product-grid">
      <article v-for="product in products" :key="product.id" class="product-card">
        <div class="product-card-image">
          <img
            v-if="product.images?.length"
            :src="product.images[0].thumbnail_url"
            :alt="product.name"
            loading="lazy"
          />
          <div v-else class="product-image-placeholder"><Package :size="31" /></div>
          <span v-if="product.images?.length > 1" class="product-image-count">{{ product.images.length }} {{ t('images') }}</span>
        </div>
        <div class="product-card-body">
          <div class="product-card-heading">
            <div><h2>{{ product.name }}</h2><span class="product-category">{{ product.category }}</span></div>
            <div class="product-actions">
              <button v-if="canEdit" class="icon-button" type="button" :aria-label="t('editProduct')" @click="openEdit(product)"><Pencil :size="16" /></button>
              <button v-if="canDelete" class="icon-button product-delete" type="button" :aria-label="t('deleteProduct')" @click="deleteProduct(product)"><Trash2 :size="16" /></button>
            </div>
          </div>
          <p v-if="product.description" class="product-description">{{ product.description }}</p>
          <div class="product-card-details">
            <strong>{{ formatPrice(product.selling_price) }}</strong>
            <span>{{ t('stockQuantity') }}: {{ product.stock_quantity }}</span>
          </div>
          <p v-if="product.cost_price !== null && product.cost_price !== undefined" class="product-sku">{{ t('productCostPrice') }}: {{ formatPrice(product.cost_price) }}</p>
          <p v-if="product.sku" class="product-sku">{{ t('sku') }}: {{ product.sku }}</p>
        </div>
      </article>
    </div>
    <div v-else-if="!error" class="state-message"><Package :size="25" /><span>{{ t('noProducts') }}</span></div>

    <div v-if="pagination && pagination.last_page > 1" class="pagination">
      <span>{{ t('page') }} {{ pagination.current_page }} {{ t('of') }} {{ pagination.last_page }}</span>
      <div>
        <button class="button button-secondary" :disabled="page <= 1" @click="page--">{{ t('previous') }}</button>
        <button class="button button-secondary" :disabled="page >= pagination.last_page" @click="page++">{{ t('next') }}</button>
      </div>
    </div>

    <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
      <form class="modal-card product-modal" @submit.prevent="saveProduct">
        <div class="modal-heading">
          <div><p class="eyebrow">{{ t('products') }}</p><h2>{{ editingProduct ? t('editProduct') : t('addProduct') }}</h2></div>
          <button class="icon-button" type="button" :aria-label="t('cancel')" :disabled="saving" @click="closeModal"><X :size="19" /></button>
        </div>
        <div class="form-grid">
          <label>{{ t('productName') }}<span class="required-mark"> *</span><input v-model="form.name" maxlength="150" required /></label>
          <label>{{ t('category') }}<span class="required-mark"> *</span><input v-model="form.category" maxlength="100" required /></label>
          <label>{{ t('productSellingPrice') }}<span class="required-mark"> *</span><input v-model="form.selling_price" type="number" min="0" max="9999999999.99" step="0.01" required /></label>
          <label>{{ t('productCostPrice') }}<input v-model="form.cost_price" type="number" min="0" max="9999999999.99" step="0.01" /></label>
          <label>{{ t('sku') }}<input v-model="form.sku" maxlength="100" /></label>
          <label>{{ t('stockQuantity') }}<span class="required-mark"> *</span><input v-model="form.stock_quantity" type="number" min="0" max="999999999.999" step="0.001" required /></label>
          <label class="form-span">{{ t('description') }}<textarea v-model="form.description" maxlength="2000" rows="3"></textarea></label>
        </div>

        <div class="product-image-section">
          <div class="product-image-label"><span>{{ t('productImages') }}</span><small>{{ t('productImageLimits') }}</small></div>
          <div v-if="retainedImages.length || selectedFiles.length" class="product-preview-grid">
            <div v-for="image in retainedImages" :key="`existing-${image.id}`" class="product-preview">
              <img :src="image.thumbnail_url" :alt="t('productExistingImage')" />
              <button type="button" :aria-label="t('removeImage')" :disabled="saving" @click="retainedImages = retainedImages.filter((item) => item.id !== image.id)"><X :size="14" /></button>
            </div>
            <div v-for="(image, index) in selectedFiles" :key="image.preview" class="product-preview">
              <img :src="image.preview" :alt="image.file.name" />
              <button type="button" :aria-label="t('removeImage')" :disabled="saving" @click="removeSelectedFile(index)"><X :size="14" /></button>
            </div>
          </div>
          <input ref="fileInput" class="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" multiple @change="addFiles" />
          <button
            class="button button-secondary product-upload-button"
            type="button"
            :disabled="saving || retainedImages.length + selectedFiles.length >= 5"
            @click="fileInput?.click()"
          >
            <ImagePlus :size="17" />{{ t('chooseProductImages') }}
          </button>
          <p v-if="selectedFiles.length" class="product-upload-summary"><Upload :size="14" />{{ selectedFiles.length }} {{ t('imagesSelected') }}</p>
        </div>

        <div v-if="saving && uploadProgress > 0" class="upload-progress" role="status">
          <div><span>{{ t('uploadingImages') }}</span><strong>{{ uploadProgress }}%</strong></div>
          <progress :value="uploadProgress" max="100">{{ uploadProgress }}%</progress>
        </div>
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
        <div class="modal-actions">
          <button class="button button-secondary" type="button" :disabled="saving" @click="closeModal">{{ t('cancel') }}</button>
          <button class="button button-primary" :disabled="saving">{{ saving ? t('savingProduct') : t('saveProduct') }}</button>
        </div>
      </form>
    </div>
  </section>
</template>
