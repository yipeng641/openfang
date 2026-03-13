import { normalizeItems } from './data-utils'

function toText(value) {
  return value == null ? '' : String(value)
}

export function classifyLogLevel(action) {
  const text = toText(action).toLowerCase()
  if (!text) return 'info'
  if (text.includes('error') || text.includes('fail') || text.includes('crash')) return 'error'
  if (text.includes('warn') || text.includes('deny') || text.includes('block') || text.includes('rate')) return 'warn'
  return 'info'
}

export function normalizeLogEntries(data) {
  return normalizeItems(data).map((entry, index) => ({
    key: entry.seq || entry.id || `${entry.timestamp || 'log'}-${index}`,
    seq: entry.seq || index,
    timestamp: entry.timestamp || null,
    action: entry.action || 'Unknown',
    detail: entry.detail || '',
    outcome: entry.outcome || '',
    agentId: entry.agent_id || entry.actor || '-',
    level: classifyLogLevel(entry.action),
    raw: entry,
  }))
}

export function filterLogEntries(entries, { level = '', query = '', action = '' } = {}) {
  const normalizedQuery = toText(query).trim().toLowerCase()
  const normalizedAction = toText(action).trim()

  return entries.filter((entry) => {
    if (level && entry.level !== level) return false
    if (normalizedAction && entry.action !== normalizedAction) return false
    if (!normalizedQuery) return true

    const haystack = [entry.action, entry.detail, entry.agentId, entry.outcome]
      .map((value) => toText(value).toLowerCase())
      .join(' ')

    return haystack.includes(normalizedQuery)
  })
}

export function formatLogTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return toText(value)
  return date.toLocaleTimeString([], { hour12: false })
}

export function exportLogLines(entries) {
  return entries
    .map((entry) => `${entry.timestamp || '-'} [${entry.level.toUpperCase()}] ${entry.action} ${entry.detail || ''}`.trim())
    .join('\n')
}
