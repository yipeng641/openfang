import { describe, expect, it } from 'vitest'
import { filterSessions, formatDateTime, normalizeMemoryPairs, normalizeSessions, truncateMiddle } from './sessions-utils'

describe('sessions utils', () => {
  it('truncates ids and formats dates', () => {
    expect(truncateMiddle('1234567890abcdef')).toBe('12345678...cdef')
    expect(formatDateTime('2026-03-13T17:04:49Z')).toMatch(/^2026\/\d{2}\/\d{2} /)
  })

  it('normalizes and filters sessions', () => {
    const sessions = normalizeSessions(
      [{ session_id: 'abc123456789', agent_id: '1', message_count: 4, created_at: '2026-03-13T10:00:00Z', label: 'Research' }],
      [{ id: '1', name: 'collector-hand' }],
    )

    expect(sessions[0].agentName).toBe('collector-hand')
    expect(filterSessions(sessions, 'collector')).toHaveLength(1)
    expect(filterSessions(sessions, 'missing')).toHaveLength(0)
  })

  it('normalizes memory pairs', () => {
    const pairs = normalizeMemoryPairs([{ key: 'config', value: { enabled: true } }])
    expect(pairs[0].memoryKey).toBe('config')
    expect(pairs[0].valueText).toContain('enabled')
  })
})
