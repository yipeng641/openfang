<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiGet } from '../api'
import {
  buildAnalyticsSummary,
  calculateProjectedMonthlyCost,
  formatCompactNumber,
  formatCurrency,
  normalizeAgentRows,
  normalizeDailyRows,
  normalizeModelRows,
} from '../analytics-utils'

const loading = ref(false)
const activeTab = ref('summary')
const summaryPayload = ref({})
const byModelPayload = ref({ models: [] })
const usagePayload = ref({ agents: [] })
const dailyPayload = ref({ days: [], today_cost_usd: 0, first_event_date: null })

const summary = computed(() => buildAnalyticsSummary(summaryPayload.value))
const modelRows = computed(() => normalizeModelRows(byModelPayload.value))
const agentRows = computed(() => normalizeAgentRows(usagePayload.value))
const dailyRows = computed(() => normalizeDailyRows(dailyPayload.value))
const projectedMonthlyCost = computed(() => {
  return calculateProjectedMonthlyCost(summary.value.totalCostUsd, dailyPayload.value.first_event_date)
})

const metricCards = computed(() => [
  { key: 'tokens', label: 'Total Tokens', value: formatCompactNumber(summary.value.totalTokens), accent: 'text-orange-500' },
  { key: 'cost', label: 'Estimated Cost', value: formatCurrency(summary.value.totalCostUsd), accent: 'text-orange-500' },
  { key: 'calls', label: 'API Calls', value: formatCompactNumber(summary.value.callCount, 0), accent: 'text-orange-500' },
  { key: 'tools', label: 'Tool Calls', value: formatCompactNumber(summary.value.totalToolCalls, 0), accent: 'text-orange-500' },
])

const summaryRows = computed(() => [
  { key: 'input', label: 'Input Tokens', value: formatCompactNumber(summary.value.inputTokens) },
  { key: 'output', label: 'Output Tokens', value: formatCompactNumber(summary.value.outputTokens) },
  { key: 'cost', label: 'Total Cost', value: formatCurrency(summary.value.totalCostUsd) },
  { key: 'calls', label: 'API Calls', value: formatCompactNumber(summary.value.callCount, 0) },
  { key: 'tools', label: 'Tool Calls', value: formatCompactNumber(summary.value.totalToolCalls, 0) },
])

const modelColumns = [
  { title: 'Model', dataIndex: 'model', key: 'model', ellipsis: true },
  { title: 'Input', dataIndex: 'inputTokens', key: 'inputTokens', customRender: ({ value }) => formatCompactNumber(value) },
  { title: 'Output', dataIndex: 'outputTokens', key: 'outputTokens', customRender: ({ value }) => formatCompactNumber(value) },
  { title: 'Total', dataIndex: 'totalTokens', key: 'totalTokens', customRender: ({ value }) => formatCompactNumber(value) },
  { title: 'Calls', dataIndex: 'callCount', key: 'callCount' },
  { title: 'Cost', dataIndex: 'totalCostUsd', key: 'totalCostUsd', customRender: ({ value }) => formatCurrency(value) },
]

const agentColumns = [
  { title: 'Agent', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Total Tokens', dataIndex: 'totalTokens', key: 'totalTokens', customRender: ({ value }) => formatCompactNumber(value) },
  { title: 'Tool Calls', dataIndex: 'toolCalls', key: 'toolCalls' },
]

const dailyColumns = [
  { title: 'Date', dataIndex: 'date', key: 'date' },
  { title: 'Cost', dataIndex: 'costUsd', key: 'costUsd', customRender: ({ value }) => formatCurrency(value) },
  { title: 'Tokens', dataIndex: 'tokens', key: 'tokens', customRender: ({ value }) => formatCompactNumber(value) },
  { title: 'Calls', dataIndex: 'calls', key: 'calls' },
]

async function loadData() {
  loading.value = true
  try {
    const [summaryData, byModelData, usageData, dailyData] = await Promise.all([
      apiGet('/api/usage/summary').catch(() => ({})),
      apiGet('/api/usage/by-model').catch(() => ({ models: [] })),
      apiGet('/api/usage').catch(() => ({ agents: [] })),
      apiGet('/api/usage/daily').catch(() => ({ days: [], today_cost_usd: 0, first_event_date: null })),
    ])

    summaryPayload.value = summaryData
    byModelPayload.value = byModelData
    usagePayload.value = usageData
    dailyPayload.value = dailyData
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-5">
    <div class="grid gap-4 xl:grid-cols-4">
      <div v-for="card in metricCards" :key="card.key" class="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
        <div :class="['text-3xl font-semibold', card.accent]">{{ card.value }}</div>
        <div class="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ card.label }}</div>
      </div>
    </div>

    <a-tabs v-model:activeKey="activeTab" :animated="false" class="analytics-tabs">
      <a-tab-pane key="summary" tab="Summary">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div class="px-2 pb-3 text-sm font-semibold text-slate-900">Token Breakdown</div>
          <div class="divide-y divide-slate-200">
            <div v-for="row in summaryRows" :key="row.key" class="flex items-center justify-between gap-4 px-2 py-3 text-sm">
              <span class="font-semibold uppercase tracking-[0.08em] text-slate-500">{{ row.label }}</span>
              <span class="font-medium text-slate-900">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="model" tab="By Model">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <a-table
            :columns="modelColumns"
            :data-source="modelRows"
            :loading="loading"
            :pagination="{ pageSize: 8, hideOnSinglePage: true }"
            row-key="key"
            size="small"
            :scroll="{ x: 860 }"
          />
        </div>
      </a-tab-pane>

      <a-tab-pane key="agent" tab="By Agent">
        <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <a-table
            :columns="agentColumns"
            :data-source="agentRows"
            :loading="loading"
            :pagination="{ pageSize: 8, hideOnSinglePage: true }"
            row-key="key"
            size="small"
            :scroll="{ x: 720 }"
          />
        </div>
      </a-tab-pane>

      <a-tab-pane key="costs" tab="Costs">
        <div class="space-y-4">
          <div class="grid gap-4 lg:grid-cols-3">
            <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Today Cost</div>
              <div class="mt-3 text-2xl font-semibold text-slate-900">{{ formatCurrency(dailyPayload.today_cost_usd) }}</div>
            </div>
            <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Projected Monthly</div>
              <div class="mt-3 text-2xl font-semibold text-slate-900">{{ formatCurrency(projectedMonthlyCost) }}</div>
            </div>
            <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tracking Since</div>
              <div class="mt-3 text-2xl font-semibold text-slate-900">{{ dailyPayload.first_event_date || '-' }}</div>
            </div>
          </div>

          <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <a-table
              :columns="dailyColumns"
              :data-source="dailyRows"
              :loading="loading"
              :pagination="{ pageSize: 7, hideOnSinglePage: true }"
              row-key="key"
              size="small"
            />
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
