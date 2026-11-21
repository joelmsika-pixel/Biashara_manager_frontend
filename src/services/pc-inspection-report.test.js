import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPcInspectionPdf, pcHealthCondition } from './pc-inspection-report.js'

test('maps each requested health percentage boundary to its condition', () => {
  assert.equal(pcHealthCondition(0), 'normal')
  assert.equal(pcHealthCondition(60), 'normal')
  assert.equal(pcHealthCondition(61), 'good')
  assert.equal(pcHealthCondition(70), 'good')
  assert.equal(pcHealthCondition(71), 'excellent')
  assert.equal(pcHealthCondition(80), 'excellent')
  assert.equal(pcHealthCondition(81), 'super')
  assert.equal(pcHealthCondition(100), 'super')
})

test('does not assign a condition to missing or invalid percentages', () => {
  assert.equal(pcHealthCondition(''), '')
  assert.equal(pcHealthCondition(null), '')
  assert.equal(pcHealthCondition(-1), '')
  assert.equal(pcHealthCondition(101), '')
  assert.equal(pcHealthCondition(60.5), '')
})

test('builds a downloadable PDF with a page for each of 100 PCs', async () => {
  const report = {
    id: 7,
    business_name: 'Example Business',
    prepared_by_name: 'Example Employee',
    created_at: new Date().toISOString(),
    devices: Array.from({ length: 100 }, (_, index) => ({
      device_name: `PC ${index + 1}`,
      computer_received_type: '',
      charger_type: '',
      charger_functionality: '',
      charger_brand: '',
      total_chargers_received: null,
      laptop_model: '',
      laptop_id: '',
      pre_sound: '',
      pre_condition: '',
      storage: '',
      keyboard: '',
      disk_health: null,
      battery_health: null,
      post_sound: '',
      reported_issue: '',
    })),
  }
  const labels = new Proxy({}, { get: (_target, key) => String(key) })
  const blob = await buildPcInspectionPdf(report, labels)
  const pdfText = new TextDecoder().decode(await blob.arrayBuffer())

  assert.equal(blob.type, 'application/pdf')
  assert.equal((pdfText.match(/\/Type \/Page\b/g) || []).length, 100)
})
