import { describe, expect, it } from 'vitest'
import { classifyLogLevel, exportLogLines, filterLogEntries, formatLogTime, normalizeLogEntries } from './logs-utils'

describe('logs utils', () => {
  it('classifies log levels from actions', () => {
    expect(classifyLogLevel('AuthFailure')).toBe('error')
    expect(classifyLogLevel('RateLimited')).toBe('warn')
    expect(classifyLogLevel('ToolInvoke')).toBe('info')
  })

  it('normalizes and filters entries', () => {
    const entries = normalizeLogEntries({
      entries: [
        { seq: 1, timestamp: '2026-03-13T12:00:00Z', action: 'ToolInvoke', detail: 'search docs', agent_id: 'planner' },
        { seq: 2, timestamp: '2026-03-13T12:01:00Z', action: 'AuthFailure', detail: 'token missing', agent_id: 'worker' },
      ],
    })

    expect(entries[0].level).toBe('info')
    expect(filterLogEntries(entries, { level: 'error' })).toHaveLength(1)
    expect(filterLogEntries(entries, { query: 'planner' })).toHaveLength(1)
    expect(filterLogEntries(entries, { action: 'ToolInvoke' })).toHaveLength(1)
  })

  it('formats and exports lines', () => {
    const entries = normalizeLogEntries({ entries: [{ seq: 1, timestamp: '2026-03-13T12:00:00Z', action: 'ToolInvoke', detail: 'ok' }] })
    expect(formatLogTime('2026-03-13T12:00:00Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    expect(exportLogLines(entries)).toContain('[INFO] ToolInvoke ok')
  })
})
