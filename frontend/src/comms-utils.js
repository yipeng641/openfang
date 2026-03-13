import { normalizeItems } from './data-utils'

export function formatCommsTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

export function normalizeTopology(data = {}) {
  const nodes = Array.isArray(data.nodes) ? data.nodes : []
  const edges = Array.isArray(data.edges) ? data.edges : []

  return {
    nodes: nodes.map((node, index) => ({
      key: node.id || `node-${index}`,
      id: node.id || '',
      name: node.name || node.id || '-',
      state: node.state || '-',
      model: node.model || '-',
    })),
    edges: edges.map((edge, index) => ({
      key: `${edge.from || 'unknown'}-${edge.to || 'unknown'}-${index}`,
      from: edge.from || '-',
      to: edge.to || '-',
      kind: edge.kind || '-',
    })),
  }
}

export function normalizeCommsEvents(data) {
  return normalizeItems(data).map((event, index) => ({
    key: event.id || `event-${index}`,
    id: event.id || '',
    timestamp: event.timestamp || '',
    kind: event.kind || '-',
    sourceName: event.source_name || event.source_id || '-',
    targetName: event.target_name || event.target_id || '-',
    detail: event.detail || '-',
  }))
}

export function filterCommsEvents(events, query = '') {
  const normalized = String(query || '').trim().toLowerCase()
  if (!normalized) return events

  return events.filter((event) => {
    return [event.kind, event.sourceName, event.targetName, event.detail]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized))
  })
}
