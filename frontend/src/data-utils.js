export function normalizeItems(data) {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []

  const preferredKeys = [
    'agents',
    'approvals',
    'events',
    'channels',
    'skills',
    'workflows',
    'runs',
    'jobs',
    'triggers',
    'providers',
    'models',
    'nodes',
    'edges',
    'items',
    'data',
  ]

  for (const key of preferredKeys) {
    if (Array.isArray(data[key])) return data[key]
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value)) return value
  }

  return []
}

export function getPrimitiveEntries(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data).filter(([, value]) => {
    return value == null || ['string', 'number', 'boolean'].includes(typeof value)
  })
}

export function getDisplayColumns(items) {
  const sample = items.find((item) => item && typeof item === 'object')
  if (!sample) return []

  const preferredKeys = [
    'id',
    'name',
    'title',
    'display_name',
    'provider',
    'model',
    'status',
    'state',
    'kind',
    'type',
    'created_at',
    'updated_at',
    'timestamp',
  ]

  const keys = [...new Set([...preferredKeys.filter((key) => key in sample), ...Object.keys(sample)])]
  return keys
    .filter((key) => key !== 'raw')
    .slice(0, 6)
    .map((key) => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
      dataIndex: key,
      key,
    }))
}

export function formatValue(value) {
  if (value == null || value === '') return '-'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function summarizeData(data) {
  if (Array.isArray(data)) return `${data.length} item${data.length === 1 ? '' : 's'}`
  if (!data || typeof data !== 'object') return formatValue(data)

  const parts = []
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.length}`)
    }
  }
  if (parts.length) return parts.join(' · ')

  const primitives = getPrimitiveEntries(data)
  if (primitives.length) {
    return primitives.slice(0, 3).map(([key, value]) => `${key}: ${formatValue(value)}`).join(' · ')
  }

  return 'Loaded'
}

export function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
