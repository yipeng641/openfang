import { describe, expect, it } from 'vitest'
import { formatCompactNumber, formatCurrency, formatDuration, summarizeOverviewData, timeAgo } from './overview-utils'

describe('overview utils', () => {
  it('formats compact counts and money', () => {
    expect(formatCompactNumber(1200)).toBe('1.2K')
    expect(formatCurrency(0)).toBe('$0.00')
    expect(formatCurrency(0.004)).toBe('<$0.01')
    expect(formatDuration(3665)).toBe('1h 1m')
  })

  it('builds summary counts from overview payloads', () => {
    const summary = summarizeOverviewData({
      health: { status: 'ok' },
      status: { version: '1.2.3', uptime_seconds: 7300, agent_count: 4 },
      usage: {
        agents: [
          { name: 'planner', total_tokens: 1200, tool_calls: 5, cost_usd: 0.5 },
          { name: 'worker', total_tokens: 3000, tool_calls: 2, cost_usd: 0.75 },
        ],
      },
      audit: {
        entries: [
          { action: 'ToolInvoke', actor: 'worker', timestamp: '2026-03-13T01:00:00Z' },
          { action: 'ToolInvoke', actor: 'planner', timestamp: '2026-03-13T01:01:00Z' },
          { action: 'AuthSuccess', actor: 'admin', timestamp: '2026-03-13T01:02:00Z' },
        ],
      },
      channels: {
        channels: [
          { configured: true, has_token: true },
          { configured: false, has_token: false },
          { configured: true, has_token: false },
        ],
      },
      providers: {
        providers: [
          { id: 'openai', auth_status: 'configured', model_count: 12 },
          { id: 'anthropic', auth_status: 'configured', health: 'cooldown', model_count: 6 },
          { id: 'local', auth_status: 'missing', model_count: 0 },
        ],
      },
      skills: { skills: [{ name: 'one' }, { name: 'two' }] },
    })

    expect(summary.healthStatus).toBe('ok')
    expect(summary.runtimeVersion).toBe('1.2.3')
    expect(summary.usageTotals.totalTokens).toBe(4200)
    expect(summary.usageTotals.totalTools).toBe(7)
    expect(summary.providerCounts).toEqual({ total: 3, ready: 1, degraded: 1, pending: 1 })
    expect(summary.channelCounts).toEqual({ total: 3, ready: 1, missingToken: 2, pending: 0 })
    expect(summary.skillCount).toBe(2)
    expect(summary.topAgents[0].name).toBe('worker')
    expect(summary.topActions[0]).toEqual({ name: 'ToolInvoke', count: 2 })
  })

  it('formats relative time safely', () => {
    expect(timeAgo('2026-03-13T01:00:00Z', new Date('2026-03-13T01:00:05Z').getTime())).toBe('just now')
    expect(timeAgo(null)).toBe('-')
  })
})
