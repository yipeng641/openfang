export function truncateMiddle(value, head = 8, tail = 4) {
  const text = String(value || '')
  if (text.length <= head + tail + 3) return text
  return `${text.slice(0, head)}...${text.slice(-tail)}`
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}

export function normalizeSessions(rawSessions = [], agents = []) {
  const agentMap = new Map(agents.map((agent) => [String(agent.id), agent.name || agent.display_name || String(agent.id)]))

  return (Array.isArray(rawSessions) ? rawSessions : [])
    .map((session, index) => ({
      key: session.session_id || `session-${index}`,
      sessionId: session.session_id || '',
      sessionLabel: session.label || '',
      sessionDisplay: session.label || truncateMiddle(session.session_id || ''),
      agentId: session.agent_id || '',
      agentName: agentMap.get(String(session.agent_id || '')) || String(session.agent_id || '-'),
      messageCount: Number(session.message_count || 0),
      createdAt: session.created_at || '',
    }))
}

export function filterSessions(sessions, query = '') {
  const normalized = String(query || '').trim().toLowerCase()
  if (!normalized) return sessions

  return sessions.filter((session) => {
    return [session.sessionId, session.sessionLabel, session.agentId, session.agentName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized))
  })
}

export function normalizeMemoryPairs(rawPairs = []) {
  return (Array.isArray(rawPairs) ? rawPairs : []).map((item, index) => ({
    key: item.key || `key-${index}`,
    memoryKey: item.key || '',
    value: item.value,
    valueText: typeof item.value === 'string' ? item.value : JSON.stringify(item.value, null, 2),
  }))
}
