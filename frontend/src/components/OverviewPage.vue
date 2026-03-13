<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiGet } from '../api'
import { nativePageDefinitions } from '../native-pages'
import {
  formatCompactNumber,
  formatCurrency,
  formatDuration,
  summarizeOverviewData,
} from '../overview-utils'

const loading = ref(false)
const sections = ref([])

const definition = nativePageDefinitions.overview

const sectionsByKey = computed(() => {
  return Object.fromEntries(sections.value.map((section) => [section.key, section]))
})

const summary = computed(() => {
  return summarizeOverviewData({
    health: sectionsByKey.value.health?.data,
    status: sectionsByKey.value.status?.data,
    usage: sectionsByKey.value.usage?.data,
    audit: sectionsByKey.value.audit?.data,
    channels: sectionsByKey.value.channels?.data,
    providers: sectionsByKey.value.providers?.data,
    skills: sectionsByKey.value.skills?.data,
  })
})

const metricCards = computed(() => [
  {
    key: 'health',
    label: 'System Health',
    value: summary.value.healthStatus === 'ok' ? 'Healthy' : summary.value.healthStatus || 'Unknown',
    hint: `Version ${summary.value.runtimeVersion}`,
  },
  {
    key: 'uptime',
    label: 'Uptime',
    value: formatDuration(summary.value.uptimeSeconds),
    hint: `${summary.value.agentCount} active agents`,
  },
  {
    key: 'tokens',
    label: 'Total Tokens',
    value: formatCompactNumber(summary.value.usageTotals.totalTokens),
    hint: `${summary.value.topAgents.length} agents with usage`,
  },
  {
    key: 'tools',
    label: 'Tool Calls',
    value: formatCompactNumber(summary.value.usageTotals.totalTools),
    hint: `${summary.value.auditCount} recent audit events`,
  },
  {
    key: 'cost',
    label: 'Total Cost',
    value: formatCurrency(summary.value.usageTotals.totalCost),
    hint: 'Aggregated from agent usage',
  },
  {
    key: 'skills',
    label: 'Installed Skills',
    value: String(summary.value.skillCount),
    hint: `${summary.value.providerCounts.total} providers · ${summary.value.channelCounts.total} channels`,
  },
])

function barWidth(value, max) {
  if (!max) return '0%'
  return `${Math.max(10, Math.round((value / max) * 100))}%`
}

async function loadData() {
  loading.value = true
  try {
    const results = await Promise.all(
      definition.loaders.map(async (loader) => {
        try {
          const data = await apiGet(loader.path)
          return { ...loader, data, error: '' }
        } catch (error) {
          return { ...loader, data: null, error: error.message }
        }
      }),
    )
    sections.value = results
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="card in metricCards"
        :key="card.key"
        class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ card.label }}</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ card.value }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ card.hint }}</div>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-base font-semibold text-slate-900">Usage by Agent</div>
            <div class="mt-1 text-sm text-slate-500">Top 5 agents ranked by aggregated token usage.</div>
          </div>
          <a-tag color="blue">Top {{ summary.topAgents.length || 0 }}</a-tag>
        </div>

        <div v-if="summary.topAgents.length" class="mt-6 space-y-5">
          <div v-for="agent in summary.topAgents" :key="agent.name">
            <div class="flex items-center justify-between gap-4 text-sm">
              <div class="min-w-0 truncate font-medium text-slate-900">{{ agent.name }}</div>
              <div class="shrink-0 text-slate-500">{{ formatCompactNumber(agent.totalTokens) }} tokens</div>
            </div>
            <div class="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                :style="{ width: barWidth(agent.totalTokens, summary.topAgentTokens) }"
              />
            </div>
            <div class="mt-2 flex items-center justify-between gap-4 text-xs text-slate-500">
              <span>{{ formatCurrency(agent.costUsd) }}</span>
              <span>{{ formatCompactNumber(agent.toolCalls) }} tool calls</span>
            </div>
          </div>
        </div>
        <a-empty v-else description="No usage data yet" class="py-10" />
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-base font-semibold text-slate-900">Provider Snapshot</div>
          <div class="mt-1 text-sm text-slate-500">Provider readiness summarized instead of raw rows.</div>

          <div class="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <div class="rounded-xl bg-emerald-50 p-4">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Ready</div>
              <div class="mt-2 text-2xl font-semibold text-emerald-900">{{ summary.providerCounts.ready }}</div>
            </div>
            <div class="rounded-xl bg-amber-50 p-4">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Degraded</div>
              <div class="mt-2 text-2xl font-semibold text-amber-900">{{ summary.providerCounts.degraded }}</div>
            </div>
            <div class="rounded-xl bg-slate-100 p-4">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Pending</div>
              <div class="mt-2 text-2xl font-semibold text-slate-900">{{ summary.providerCounts.pending }}</div>
            </div>
          </div>

          <div v-if="summary.topProviderModels.length" class="mt-5 space-y-3">
            <div
              v-for="provider in summary.topProviderModels"
              :key="provider.name"
              class="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3"
            >
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-slate-900">{{ provider.name }}</div>
                <div class="mt-1 text-xs text-slate-500">
                  {{ provider.configured ? 'Configured' : 'Needs setup' }}
                  <span v-if="provider.degraded"> · Degraded</span>
                </div>
              </div>
              <div class="text-sm font-semibold text-slate-700">{{ provider.modelCount }} models</div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-base font-semibold text-slate-900">Channel Snapshot</div>
          <div class="mt-1 text-sm text-slate-500">Channel status rolled up into ready, missing token, and pending setup.</div>

          <div class="mt-5 space-y-3">
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Ready</span>
                <span class="font-medium text-slate-900">{{ summary.channelCounts.ready }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-emerald-500" :style="{ width: barWidth(summary.channelCounts.ready, Math.max(1, summary.channelCounts.total)) }" />
              </div>
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Missing Token</span>
                <span class="font-medium text-slate-900">{{ summary.channelCounts.missingToken }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-amber-500" :style="{ width: barWidth(summary.channelCounts.missingToken, Math.max(1, summary.channelCounts.total)) }" />
              </div>
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Pending Setup</span>
                <span class="font-medium text-slate-900">{{ summary.channelCounts.pending }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-slate-400" :style="{ width: barWidth(summary.channelCounts.pending, Math.max(1, summary.channelCounts.total)) }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
