<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue, getDisplayColumns, getPrimitiveEntries, normalizeItems, safeJson } from '../data-utils'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('status')
const statusData = ref({})
const versionData = ref({})
const toolsData = ref({})
const agentsData = ref({})

const toolRows = computed(() => {
  const tools = normalizeItems(toolsData.value)
  return tools.map((tool, index) => (typeof tool === 'string' ? { name: tool, _row_key: `${tool}-${index}` } : { ...tool, _row_key: tool.id || tool.name || index }))
})

const agentRows = computed(() => normalizeItems(agentsData.value).map((item, index) => ({
  _row_key: item?.id || item?.name || index,
  ...item,
})))

const toolColumns = computed(() => getDisplayColumns(toolRows.value))
const agentColumns = computed(() => getDisplayColumns(agentRows.value))
const statusEntries = computed(() => getPrimitiveEntries(statusData.value))
const versionEntries = computed(() => getPrimitiveEntries(versionData.value))

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [statusResult, versionResult, toolsResult, agentsResult] = await Promise.allSettled([
    apiGet('/api/status'),
    apiGet('/api/version'),
    apiGet('/api/tools'),
    apiGet('/api/agents'),
  ])

  if (statusResult.status === 'fulfilled') {
    statusData.value = statusResult.value
  } else {
    statusData.value = {}
    loadError.value = statusResult.reason.message
  }

  versionData.value = versionResult.status === 'fulfilled' ? versionResult.value : {}
  toolsData.value = toolsResult.status === 'fulfilled' ? toolsResult.value : {}
  agentsData.value = agentsResult.status === 'fulfilled' ? agentsResult.value : {}

  if (loadError.value) {
    message.error(`Failed to load runtime page: ${loadError.value}`)
  }

  loading.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-slate-900">Runtime</div>
          <div class="mt-1 text-sm text-slate-500">Core runtime facts are split into dedicated tabs instead of a shared generic renderer.</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Status</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ statusData.status || 'unknown' }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ statusData.agent_count || 0 }} active agents</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Version</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ versionData.version || '-' }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ versionData.git_sha || 'No git SHA' }}</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tools</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ toolRows.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Available runtime tools</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Agents</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ agentRows.length || statusData.agent_count || 0 }}</div>
        <div class="mt-2 text-sm text-slate-500">Registered agent records</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="status" tab="Status">
          <a-descriptions bordered size="small" :column="1">
            <a-descriptions-item v-for="([key, value]) in statusEntries" :key="key" :label="key">
              {{ formatValue(value) }}
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>

        <a-tab-pane key="version" tab="Version">
          <a-descriptions bordered size="small" :column="1">
            <a-descriptions-item v-for="([key, value]) in versionEntries" :key="key" :label="key">
              {{ formatValue(value) }}
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>

        <a-tab-pane key="tools" tab="Tools">
          <a-table
            :columns="toolColumns"
            :data-source="toolRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          />
        </a-tab-pane>

        <a-tab-pane key="agents" tab="Agents">
          <a-table
            :columns="agentColumns"
            :data-source="agentRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          />
          <pre v-if="!agentRows.length" class="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{ safeJson(agentsData) }}</pre>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
