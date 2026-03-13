import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsSummary,
  calculateProjectedMonthlyCost,
  formatCompactNumber,
  formatCurrency,
  normalizeAgentRows,
  normalizeDailyRows,
  normalizeModelRows,
} from './analytics-utils'

describe('analytics utils', () => {
  it('formats analytics values', () => {
    expect(formatCompactNumber(25_230_000)).toBe('25.23M')
    expect(formatCurrency(7.98)).toBe('$7.98')
    expect(formatCurrency(0.0042)).toBe('$0.0042')
  })

  it('builds summary metrics and projection', () => {
    expect(buildAnalyticsSummary({
      total_input_tokens: 100,
      total_output_tokens: 50,
      total_cost_usd: 1.5,
      call_count: 4,
      total_tool_calls: 9,
    })).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      totalCostUsd: 1.5,
      callCount: 4,
      totalToolCalls: 9,
    })

    const projected = calculateProjectedMonthlyCost(3, '2026-03-10T00:00:00Z', new Date('2026-03-13T00:00:00Z').getTime())
    expect(projected).toBeCloseTo(30, 2)
  })

  it('normalizes model, agent, and daily rows', () => {
    const models = normalizeModelRows({
      models: [
        { model: 'a', total_input_tokens: 10, total_output_tokens: 20, total_cost_usd: 1, call_count: 2 },
        { model: 'b', total_input_tokens: 50, total_output_tokens: 30, total_cost_usd: 0.5, call_count: 4 },
      ],
    })
    expect(models[0].model).toBe('b')
    expect(models[0].totalTokens).toBe(80)

    const agents = normalizeAgentRows({ agents: [{ name: 'worker', total_tokens: 90, tool_calls: 3 }] })
    expect(agents[0]).toEqual({ key: 'agent-0', name: 'worker', totalTokens: 90, toolCalls: 3 })

    const daily = normalizeDailyRows({ days: [{ date: '2026-03-12', cost_usd: 1 }, { date: '2026-03-13', cost_usd: 2 }] })
    expect(daily[0].date).toBe('2026-03-13')
  })
})
