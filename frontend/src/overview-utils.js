import { normalizeItems } from './data-utils'

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function providerName(provider, index) {
  return provider.display_name || provider.name || provider.id || `Provider ${index + 1}`
}

function agentName(agent, index) {
  return agent.name || agent.agent_name || agent.id || agent.agent_id || `Agent ${index + 1}`
}

function isProviderConfigured(provider) {
  return ['configured', 'not_required'].includes(String(provider?.auth_status || '').toLowerCase())
}

function isProviderDegraded(provider) {
  return ['cooldown', 'open'].includes(String(provider?.health || '').toLowerCase())
}

function isChannelReady(channel) {
  return Boolean(channel?.configured && channel?.has_token)
}

export function formatCompactNumber(value) {
  const amount = toNumber(value)
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  return String(Math.round(amount))
}

export function formatCurrency(value) {
  const amount = toNumber(value)
  if (amount === 0) return '$0.00'
  if (amount < 0.01) return '<$0.01'
  return `$${amount.toFixed(2)}`
}

export function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(toNumber(seconds)))
  if (totalSeconds < 60) return `${totalSeconds}s`

  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function timeAgo(value, now = Date.now()) {
  if (!value) return '-'

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return '-'

  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (diffSeconds < 10) return 'just now'
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffSeconds < 3_600) return `${Math.floor(diffSeconds / 60)}m ago`
  if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3_600)}h ago`
  return `${Math.floor(diffSeconds / 86_400)}d ago`
}

export function summarizeOverviewData(payload = {}) {
  const health = payload.health || {}
  const status = payload.status || {}
  const usageAgents = normalizeItems(payload.usage).map((agent, index) => ({
    ...agent,
    _name: agentName(agent, index),
    total_tokens: toNumber(agent?.total_tokens),
    tool_calls: toNumber(agent?.tool_calls),
    cost_usd: toNumber(agent?.cost_usd),
  }))
  const auditEntries = normalizeItems(payload.audit)
  const channels = normalizeItems(payload.channels)
  const providers = normalizeItems(payload.providers)
  const skills = normalizeItems(payload.skills)

  const usageTotals = usageAgents.reduce(
    (totals, agent) => ({
      totalTokens: totals.totalTokens + agent.total_tokens,
      totalTools: totals.totalTools + agent.tool_calls,
      totalCost: totals.totalCost + agent.cost_usd,
    }),
    { totalTokens: 0, totalTools: 0, totalCost: 0 },
  )

  const readyProviders = providers.filter((provider) => isProviderConfigured(provider) && !isProviderDegraded(provider))
  const degradedProviders = providers.filter((provider) => isProviderConfigured(provider) && isProviderDegraded(provider))
  const unconfiguredProviders = Math.max(0, providers.length - readyProviders.length - degradedProviders.length)

  const readyChannels = channels.filter((channel) => isChannelReady(channel))
  const missingTokenChannels = channels.filter((channel) => !channel?.has_token)
  const setupChannels = Math.max(0, channels.length - readyChannels.length - missingTokenChannels.length)

  const topAgents = [...usageAgents]
    .sort((left, right) => right.total_tokens - left.total_tokens)
    .slice(0, 5)
    .map((agent) => ({
      name: agent._name,
      totalTokens: agent.total_tokens,
      toolCalls: agent.tool_calls,
      costUsd: agent.cost_usd,
    }))

  const topAgentTokens = Math.max(1, ...topAgents.map((agent) => agent.totalTokens))

  const topProviderModels = [...providers]
    .map((provider, index) => ({
      name: providerName(provider, index),
      modelCount: toNumber(provider?.model_count),
      configured: isProviderConfigured(provider),
      degraded: isProviderDegraded(provider),
    }))
    .sort((left, right) => right.modelCount - left.modelCount)
    .slice(0, 5)

  const recentAudit = auditEntries.slice(0, 6).map((entry, index) => ({
    id: entry.id || entry.ts || entry.timestamp || `${entry.action || 'event'}-${index}`,
    action: entry.action || entry.kind || 'Unknown',
    actor: entry.actor || entry.agent || entry.subject || '-',
    timestamp: entry.ts || entry.timestamp || entry.created_at || null,
  }))

  const auditActionCounts = auditEntries.reduce((counts, entry) => {
    const action = entry?.action || entry?.kind || 'Unknown'
    counts[action] = (counts[action] || 0) + 1
    return counts
  }, {})

  const topActions = Object.entries(auditActionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)

  const healthStatus = String(health?.status || status?.status || 'unknown').toLowerCase()

  return {
    healthStatus,
    runtimeVersion: status?.version || health?.version || '-',
    uptimeSeconds: toNumber(status?.uptime_seconds || status?.uptime_secs),
    agentCount: toNumber(status?.agent_count) || usageAgents.length,
    skillCount: skills.length,
    auditCount: auditEntries.length,
    usageTotals,
    providerCounts: {
      total: providers.length,
      ready: readyProviders.length,
      degraded: degradedProviders.length,
      pending: unconfiguredProviders,
    },
    channelCounts: {
      total: channels.length,
      ready: readyChannels.length,
      missingToken: missingTokenChannels.length,
      pending: setupChannels,
    },
    topAgents,
    topAgentTokens,
    topProviderModels,
    topActions,
    recentAudit,
  }
}
