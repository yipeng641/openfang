import { normalizeItems } from './data-utils'

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatCompactNumber(value, digits = 2) {
  const amount = toNumber(value)
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(digits)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return String(Math.round(amount))
}

export function formatCurrency(value) {
  const amount = toNumber(value)
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return `$${amount.toFixed(4)}`
  return `$${amount.toFixed(2)}`
}

export function calculateProjectedMonthlyCost(totalCostUsd, firstEventDate, now = Date.now()) {
  const totalCost = toNumber(totalCostUsd)
  if (!firstEventDate || totalCost <= 0) return 0

  const start = new Date(firstEventDate).getTime()
  if (!Number.isFinite(start)) return 0

  const days = Math.max(1, (now - start) / (1000 * 60 * 60 * 24))
  return (totalCost / days) * 30
}

export function buildAnalyticsSummary(summary = {}) {
  const inputTokens = toNumber(summary.total_input_tokens)
  const outputTokens = toNumber(summary.total_output_tokens)
  const totalCostUsd = toNumber(summary.total_cost_usd)
  const callCount = toNumber(summary.call_count)
  const totalToolCalls = toNumber(summary.total_tool_calls)

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    totalCostUsd,
    callCount,
    totalToolCalls,
  }
}

export function normalizeModelRows(data) {
  return normalizeItems(data)
    .map((item, index) => {
      const inputTokens = toNumber(item.total_input_tokens)
      const outputTokens = toNumber(item.total_output_tokens)
      return {
        key: item.model || `model-${index}`,
        model: item.model || '-',
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        callCount: toNumber(item.call_count),
        totalCostUsd: toNumber(item.total_cost_usd),
      }
    })
    .sort((left, right) => right.totalTokens - left.totalTokens || right.totalCostUsd - left.totalCostUsd)
}

export function normalizeAgentRows(data) {
  return normalizeItems(data)
    .map((item, index) => ({
      key: item.agent_id || item.id || `agent-${index}`,
      name: item.name || item.agent_name || item.agent_id || `Agent ${index + 1}`,
      totalTokens: toNumber(item.total_tokens),
      toolCalls: toNumber(item.tool_calls),
    }))
    .sort((left, right) => right.totalTokens - left.totalTokens || right.toolCalls - left.toolCalls)
}

export function normalizeDailyRows(data) {
  return normalizeItems(data)
    .map((item, index) => ({
      key: item.date || `day-${index}`,
      date: item.date || '-',
      costUsd: toNumber(item.cost_usd),
      tokens: toNumber(item.tokens),
      calls: toNumber(item.calls),
    }))
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
}
