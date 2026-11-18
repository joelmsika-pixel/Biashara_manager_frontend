export function pcHealthCondition(value) {
  const score = value === '' || value === null || value === undefined ? NaN : Number(value)
  if (!Number.isInteger(score) || score < 0 || score > 100) return ''
  if (score <= 60) return 'normal'
  if (score <= 70) return 'good'
  if (score <= 80) return 'excellent'
  return 'super'
}

function statusLabel(status, labels) {
  if (status === 'working') return labels.working
  if (status === 'not_working') return labels.notWorking
  if (status === 'not_received') return labels.notReceived
  return labels.notProvided
}

function conditionLabel(condition, labels) {
  const labelKey = {
    good: 'conditionGood',
    excellent: 'conditionExcellent',
    normal: 'conditionNormal',
    poor: 'conditionPoor',
  }[condition]
  return labelKey ? labels[labelKey] : labels.notProvided
}

function healthLabel(value, labels) {
  if (value === '' || value === null || value === undefined) return labels.notProvided
  const rating = pcHealthCondition(value)
  const ratingLabel = rating ? labels[`health${rating[0].toUpperCase()}${rating.slice(1)}`] : ''
  return ratingLabel ? `${value}% (${ratingLabel})` : labels.notProvided
}

function printableValue(value, labels) {
  return value === '' || value === null || value === undefined
    ? labels.notProvided
    : String(value)
}

export async function buildPcInspectionPdf(report, labels, onProgress = () => {}) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 15
  const valueX = 71
  const valueWidth = pageWidth - margin - valueX
  const preparedAt = new Date(report.created_at).toLocaleString()

  for (const [index, device] of report.devices.entries()) {
    if (index > 0) pdf.addPage()
    pdf.setTextColor(34, 54, 43)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(labels.reportTitle, margin, 19)
    pdf.setFontSize(13)
    pdf.setTextColor(23, 111, 76)
    let headerCursor = 27
    const businessLines = pdf.splitTextToSize(report.business_name, pageWidth - margin * 2)
    pdf.text(businessLines, margin, headerCursor)
    headerCursor += businessLines.length * 5 + 2
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(92, 108, 98)
    for (const metadata of [
      `${labels.preparedBy}: ${report.prepared_by_name}`,
      `${labels.reportId}: ${report.id}  ·  ${labels.generatedAt}: ${preparedAt}`,
      `${labels.pcNumber} ${index + 1} / ${report.devices.length}`,
    ]) {
      const metadataLines = pdf.splitTextToSize(metadata, pageWidth - margin * 2)
      pdf.text(metadataLines, margin, headerCursor)
      headerCursor += metadataLines.length * 4 + 1
    }
    pdf.setDrawColor(23, 111, 76)
    pdf.setLineWidth(0.7)
    pdf.line(margin, headerCursor + 2, pageWidth - margin, headerCursor + 2)

    let cursor = headerCursor + 10
    const section = (title) => {
      if (cursor + 10 > pageHeight - 15) {
        pdf.addPage()
        cursor = 18
      }
      pdf.setFillColor(232, 245, 236)
      pdf.rect(margin, cursor - 5, pageWidth - margin * 2, 8, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(23, 111, 76)
      pdf.text(title, margin + 2, cursor)
      cursor += 8
    }

    const field = (title, rawValue) => {
      const value = printableValue(rawValue, labels)
      const titleLines = pdf.splitTextToSize(title, valueX - margin - 5)
      const valueLines = pdf.splitTextToSize(value, valueWidth)
      const lineCount = Math.max(titleLines.length, valueLines.length)
      const rowHeight = lineCount * 4.5 + 2
      if (cursor + rowHeight > pageHeight - 14) {
        pdf.addPage()
        cursor = 18
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(9)
        pdf.setTextColor(92, 108, 98)
        pdf.text(`${report.business_name} · ${labels.pcNumber} ${index + 1} (${labels.continued})`, margin, cursor)
        cursor += 7
      }
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(65, 81, 70)
      pdf.text(titleLines, margin, cursor)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(37, 49, 42)
      pdf.text(valueLines, valueX, cursor)
      cursor += rowHeight
    }

    section(labels.pcInformation)
    field(labels.deviceName, device.device_name)
    field(labels.computerReceivedType, device.computer_received_type)
    field(labels.chargerType, device.charger_type)
    field(labels.chargerFunctionality, statusLabel(device.charger_functionality, labels))
    field(labels.chargerBrand, device.charger_brand)
    field(labels.totalChargersReceived, device.total_chargers_received)

    section(labels.preCheckup)
    field(labels.laptopModel, device.laptop_model)
    field(labels.laptopId, device.laptop_id)
    field(labels.sound, statusLabel(device.pre_sound, labels))
    field(labels.condition, conditionLabel(device.pre_condition, labels))

    section(labels.postCheckup)
    field(labels.storage, device.storage)
    field(labels.keyboard, statusLabel(device.keyboard, labels))
    field(labels.diskHealth, healthLabel(device.disk_health, labels))
    field(labels.batteryHealth, healthLabel(device.battery_health, labels))
    field(labels.sound, statusLabel(device.post_sound, labels))

    section(labels.reportedIssue)
    field(labels.issueDetails, device.reported_issue)
    onProgress(index + 1, report.devices.length)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const totalPages = pdf.internal.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(110, 125, 115)
    pdf.text(`${page} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  return pdf.output('blob')
}

export function downloadPcInspectionPdf(blob, reportId) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pc-inspection-report-${reportId}.pdf`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
