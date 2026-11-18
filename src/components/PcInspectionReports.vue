<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, X } from '@lucide/vue'
import api from '../services/api'
import {
  buildPcInspectionPdf,
  downloadPcInspectionPdf,
  pcHealthCondition,
} from '../services/pc-inspection-report'

const props = defineProps({
  businessUrl: { type: String, required: true },
  canCreate: { type: Boolean, default: false },
  startView: { type: String, default: 'new' },
})
const emit = defineEmits(['close'])
const { t } = useI18n()
const view = ref(props.startView)
const devices = ref([blankDevice()])
const saving = ref(false)
const progress = ref(0)
const reportReady = ref(false)
const pdfBlob = ref(null)
const currentReport = ref(null)
const error = ref('')
const reports = ref([])
const historyLoading = ref(false)
const historyError = ref('')
const historyPage = ref(1)
const historyMeta = ref(null)
const historyDownloadingId = ref(null)
const historyDownloadProgress = ref(0)

const pageSize = 20
const maxDevices = 1000

watch(devices, () => {
  if (saving.value) return
  reportReady.value = false
  pdfBlob.value = null
  currentReport.value = null
  progress.value = 0
  error.value = ''
}, { deep: true })

function blankDevice() {
  return {
    device_name: '',
    computer_received_type: '',
    charger_type: '',
    charger_functionality: '',
    charger_brand: '',
    total_chargers_received: '',
    laptop_model: '',
    laptop_id: '',
    pre_sound: '',
    pre_condition: '',
    storage: '',
    keyboard: '',
    disk_health: '',
    battery_health: '',
    post_sound: '',
    reported_issue: '',
  }
}

function resetReport() {
  devices.value = [blankDevice()]
  saving.value = false
  progress.value = 0
  reportReady.value = false
  pdfBlob.value = null
  currentReport.value = null
  error.value = ''
}

function startNewReport() {
  resetReport()
  view.value = 'new'
}

function addDevice() {
  if (devices.value.length >= maxDevices) return
  resetPreparedReport()
  devices.value.push(blankDevice())
}

function removeDevice(index) {
  if (devices.value.length <= 1) return
  resetPreparedReport()
  devices.value.splice(index, 1)
}

function resetPreparedReport() {
  reportReady.value = false
  pdfBlob.value = null
  currentReport.value = null
  progress.value = 0
  error.value = ''
}

function getScoreLabel(value) {
  const condition = pcHealthCondition(value)
  return condition ? t(`health${condition[0].toUpperCase()}${condition.slice(1)}`) : t('notProvided')
}

function validateDevices() {
  if (!devices.value.length) return t('pcInspectionRequiresDevice')
  for (const [index, device] of devices.value.entries()) {
    if (!device.device_name.trim()) return t('pcInspectionDeviceNameRequired', { number: index + 1 })
    for (const key of ['disk_health', 'battery_health']) {
      const score = device[key]
      if (score !== '' && (!Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > 100)) {
        return t('pcInspectionHealthRange', { number: index + 1 })
      }
    }
  }
  return ''
}

function reportLabels() {
  return {
    reportTitle: t('pcInspectionReportTitle'),
    preparedBy: t('preparedBy'),
    reportId: t('reportId'),
    generatedAt: t('generatedAt'),
    pcNumber: t('pcNumber'),
    continued: t('continued'),
    pcInformation: t('pcInformation'),
    deviceName: t('deviceName'),
    computerReceivedType: t('computerReceivedType'),
    chargerType: t('chargerType'),
    chargerFunctionality: t('chargerFunctionality'),
    chargerBrand: t('chargerBrand'),
    totalChargersReceived: t('totalChargersReceived'),
    preCheckup: t('preCheckup'),
    laptopModel: t('laptopModel'),
    laptopId: t('laptopId'),
    sound: t('sound'),
    condition: t('condition'),
    conditionGood: t('conditionGood'),
    conditionExcellent: t('conditionExcellent'),
    conditionNormal: t('conditionNormal'),
    conditionPoor: t('conditionPoor'),
    postCheckup: t('postCheckup'),
    storage: t('storage'),
    keyboard: t('keyboard'),
    diskHealth: t('diskHealth'),
    batteryHealth: t('batteryHealth'),
    healthNormal: t('healthNormal'),
    healthGood: t('healthGood'),
    healthExcellent: t('healthExcellent'),
    healthSuper: t('healthSuper'),
    reportedIssue: t('reportedIssue'),
    issueDetails: t('issueDetails'),
    working: t('working'),
    notWorking: t('notWorking'),
    notReceived: t('notReceived'),
    notProvided: t('notProvided'),
  }
}

async function prepareReport() {
  error.value = validateDevices()
  if (error.value) return

  saving.value = true
  reportReady.value = false
  pdfBlob.value = null
  progress.value = 5
  try {
    const { data } = await api.post(`${props.businessUrl}/pc-inspection-reports`, {
      devices: devices.value,
    })
    currentReport.value = data.data
    progress.value = 10
    pdfBlob.value = await buildPcInspectionPdf(
      data.data,
      reportLabels(),
      (completed, total) => {
        progress.value = 10 + Math.round((completed / total) * 90)
      },
    )
    progress.value = 100
    reportReady.value = true
  } catch (requestError) {
    error.value = requestError.response?.data?.message
      || Object.values(requestError.response?.data?.errors || {}).flat()[0]
      || t('errorGeneric')
  } finally {
    saving.value = false
  }
}

function downloadCurrentReport() {
  if (!pdfBlob.value || !currentReport.value) return
  downloadPcInspectionPdf(pdfBlob.value, currentReport.value.id)
}

async function loadHistory(page = 1) {
  historyLoading.value = true
  historyError.value = ''
  try {
    const { data } = await api.get(`${props.businessUrl}/pc-inspection-reports`, {
      params: { page, per_page: pageSize },
    })
    reports.value = data.data || []
    historyMeta.value = data.meta || null
    historyPage.value = data.meta?.current_page || page
  } catch (requestError) {
    historyError.value = requestError.response?.data?.message || t('errorGeneric')
    reports.value = []
    historyMeta.value = null
  } finally {
    historyLoading.value = false
  }
}

async function downloadSavedReport(report) {
  historyDownloadingId.value = report.id
  historyDownloadProgress.value = 5
  historyError.value = ''
  try {
    const { data } = await api.get(`${props.businessUrl}/pc-inspection-reports/${report.id}`)
    historyDownloadProgress.value = 10
    const pdf = await buildPcInspectionPdf(
      data.data,
      reportLabels(),
      (completed, total) => {
        historyDownloadProgress.value = 10 + Math.round((completed / total) * 90)
      },
    )
    historyDownloadProgress.value = 100
    downloadPcInspectionPdf(pdf, data.data.id)
  } catch (requestError) {
    historyError.value = requestError.response?.data?.message || t('errorGeneric')
  } finally {
    historyDownloadingId.value = null
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

onMounted(() => {
  if (view.value === 'history') loadHistory()
})
</script>

<template>
  <div class="modal-backdrop" @click.self="!saving && emit('close')">
    <section class="modal-card product-modal pc-inspection-modal" role="dialog" aria-modal="true" :aria-label="t('pcInspectionReportTitle')">
      <div class="modal-heading">
        <div>
          <p class="eyebrow">{{ t('pcInspectionReports') }}</p>
          <h2>{{ view === 'history' ? t('pcInspectionHistory') : t('pcInspectionReportTitle') }}</h2>
        </div>
        <button class="icon-button" type="button" :aria-label="t('cancel')" :disabled="saving" @click="emit('close')"><X :size="19" /></button>
      </div>

      <template v-if="view === 'new'">
        <div class="pc-inspection-actions">
          <p class="inline-note">{{ t('pcInspectionBatchHint', { count: devices.length }) }}</p>
          <button class="button button-secondary" type="button" :disabled="saving || devices.length >= maxDevices" @click="addDevice">
            <Plus :size="16" />{{ t('addPc') }}
          </button>
        </div>

        <div class="pc-inspection-device-list">
          <article v-for="(device, index) in devices" :key="index" class="pc-inspection-device">
            <div class="pc-inspection-device-heading">
              <h3>{{ t('pcNumber') }} {{ index + 1 }}</h3>
              <button
                v-if="devices.length > 1"
                class="icon-button product-delete"
                type="button"
                :aria-label="t('removePc', { number: index + 1 })"
                :disabled="saving"
                @click="removeDevice(index)"
              >
                <Trash2 :size="16" />
              </button>
            </div>

            <h4>{{ t('pcInformation') }}</h4>
            <div class="form-grid">
              <label>{{ t('deviceName') }}<span class="required-mark"> *</span><input v-model="device.device_name" maxlength="150" required :disabled="saving" /></label>
              <label>{{ t('computerReceivedType') }}<input v-model="device.computer_received_type" maxlength="100" :disabled="saving" /></label>
              <label>{{ t('chargerType') }}<input v-model="device.charger_type" maxlength="100" :disabled="saving" /></label>
              <label>{{ t('chargerFunctionality') }}
                <select v-model="device.charger_functionality" :disabled="saving">
                  <option value="">{{ t('notProvided') }}</option>
                  <option value="working">{{ t('working') }}</option>
                  <option value="not_working">{{ t('notWorking') }}</option>
                  <option value="not_received">{{ t('notReceived') }}</option>
                </select>
              </label>
              <label>{{ t('chargerBrand') }}<input v-model="device.charger_brand" maxlength="100" :disabled="saving" /></label>
              <label>{{ t('totalChargersReceived') }}<input v-model.number="device.total_chargers_received" type="number" min="0" max="10000" step="1" :disabled="saving" /></label>
            </div>

            <h4>{{ t('preCheckup') }} · {{ t('computerTypeInformation') }}</h4>
            <div class="form-grid">
              <label>{{ t('laptopModel') }}<input v-model="device.laptop_model" maxlength="150" :disabled="saving" /></label>
              <label>{{ t('laptopId') }}<input v-model="device.laptop_id" maxlength="100" :disabled="saving" /></label>
              <label>{{ t('sound') }}
                <select v-model="device.pre_sound" :disabled="saving">
                  <option value="">{{ t('notProvided') }}</option>
                  <option value="working">{{ t('working') }}</option>
                  <option value="not_working">{{ t('notWorking') }}</option>
                </select>
              </label>
              <label>{{ t('condition') }}
                <select v-model="device.pre_condition" :disabled="saving">
                  <option value="">{{ t('notProvided') }}</option>
                  <option value="excellent">{{ t('conditionExcellent') }}</option>
                  <option value="good">{{ t('conditionGood') }}</option>
                  <option value="normal">{{ t('conditionNormal') }}</option>
                  <option value="poor">{{ t('conditionPoor') }}</option>
                </select>
              </label>
            </div>

            <h4>{{ t('postCheckup') }}</h4>
            <div class="form-grid">
              <label>{{ t('storage') }}<input v-model="device.storage" maxlength="100" :disabled="saving" /></label>
              <label>{{ t('keyboard') }}
                <select v-model="device.keyboard" :disabled="saving">
                  <option value="">{{ t('notProvided') }}</option>
                  <option value="working">{{ t('working') }}</option>
                  <option value="not_working">{{ t('notWorking') }}</option>
                </select>
              </label>
              <label>{{ t('diskHealth') }}
                <span class="pc-health-input">
                  <input v-model.number="device.disk_health" type="number" min="0" max="100" step="1" :disabled="saving" />
                  <span>{{ device.disk_health === '' ? t('notProvided') : `${device.disk_health}% · ${getScoreLabel(device.disk_health)}` }}</span>
                </span>
              </label>
              <label>{{ t('batteryHealth') }}
                <span class="pc-health-input">
                  <input v-model.number="device.battery_health" type="number" min="0" max="100" step="1" :disabled="saving" />
                  <span>{{ device.battery_health === '' ? t('notProvided') : `${device.battery_health}% · ${getScoreLabel(device.battery_health)}` }}</span>
                </span>
              </label>
              <label>{{ t('sound') }}
                <select v-model="device.post_sound" :disabled="saving">
                  <option value="">{{ t('notProvided') }}</option>
                  <option value="working">{{ t('working') }}</option>
                  <option value="not_working">{{ t('notWorking') }}</option>
                </select>
              </label>
            </div>

            <h4>{{ t('reportedIssue') }}</h4>
            <label class="pc-issue-field">{{ t('issueDetails') }}<textarea v-model="device.reported_issue" maxlength="2000" rows="3" :disabled="saving"></textarea></label>
          </article>
        </div>

        <div v-if="saving || reportReady" class="pc-report-progress" role="status" aria-live="polite">
          <div><span>{{ reportReady ? t('reportReady') : t('preparingReport') }}</span><strong>{{ progress }}%</strong></div>
          <progress :value="progress" max="100">{{ progress }}%</progress>
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <div class="modal-actions">
          <button v-if="reportReady" class="button button-primary" type="button" @click="downloadCurrentReport">{{ t('downloadPdf') }}</button>
          <button v-else class="button button-primary" type="button" :disabled="saving" @click="prepareReport">
            {{ saving ? t('preparingReport') : t('generateReport') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="pc-inspection-actions">
          <p class="inline-note">{{ t('pcInspectionHistoryHint') }}</p>
          <button v-if="canCreate" class="button button-primary" type="button" @click="startNewReport">{{ t('newPcInspection') }}</button>
        </div>
        <p v-if="historyLoading" class="state-message">{{ t('loadingPcReports') }}</p>
        <p v-if="historyError" class="form-error" role="alert">{{ historyError }}</p>
        <div v-if="historyDownloadingId" class="pc-report-progress" role="status" aria-live="polite">
          <div><span>{{ t('preparingReport') }}</span><strong>{{ historyDownloadProgress }}%</strong></div>
          <progress :value="historyDownloadProgress" max="100">{{ historyDownloadProgress }}%</progress>
        </div>
        <div v-if="!historyLoading && reports.length" class="pc-report-history">
          <article v-for="report in reports" :key="report.id" class="pc-report-history-item">
            <div>
              <strong>{{ report.business_name }}</strong>
              <span>{{ formatDate(report.created_at) }} · {{ t('preparedBy') }}: {{ report.prepared_by_name }}</span>
              <span>{{ t('pcCount', { count: report.device_count }) }}</span>
            </div>
            <button
              class="button button-secondary"
              type="button"
              :disabled="historyDownloadingId !== null"
              @click="downloadSavedReport(report)"
            >
              {{ historyDownloadingId === report.id ? `${historyDownloadProgress}%` : t('downloadPdf') }}
            </button>
          </article>
        </div>
        <p v-else-if="!historyLoading && !historyError" class="state-message">{{ t('noPcReports') }}</p>
        <div v-if="historyMeta && historyMeta.last_page > 1" class="pagination">
          <span>{{ t('page') }} {{ historyMeta.current_page }} {{ t('of') }} {{ historyMeta.last_page }}</span>
          <div>
            <button class="button button-secondary" type="button" :disabled="historyPage <= 1 || historyLoading" @click="loadHistory(historyPage - 1)">{{ t('previous') }}</button>
            <button class="button button-secondary" type="button" :disabled="historyPage >= historyMeta.last_page || historyLoading" @click="loadHistory(historyPage + 1)">{{ t('next') }}</button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="button button-secondary" type="button" @click="emit('close')">{{ t('cancel') }}</button>
        </div>
      </template>
    </section>
  </div>
</template>
