<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue, getDisplayColumns, normalizeItems, safeJson } from '../data-utils'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('config')
const configData = ref({})
const schemaData = ref({})
const securityData = ref({})
const peersData = ref({})

const securityCoreRows = computed(() => Object.entries(securityData.value.core_protections || {}).map(([key, value]) => ({
  key,
  enabled: value,
})))

const peerRows = computed(() => normalizeItems(peersData.value).map((peer, index) => ({
  _row_key: peer?.node_id || peer?.id || index,
  ...peer,
})))

const peerColumns = computed(() => getDisplayColumns(peerRows.value))
const enabledCoreProtections = computed(() => securityCoreRows.value.filter((row) => row.enabled).length)
const authMode = computed(() => securityData.value.configurable?.auth?.mode || '-')
const auditEntries = computed(() => securityData.value.monitoring?.audit_trail?.entry_count || 0)

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [configResult, schemaResult, securityResult, peersResult] = await Promise.allSettled([
    apiGet('/api/config'),
    apiGet('/api/config/schema'),
    apiGet('/api/security'),
    apiGet('/api/peers'),
  ])

  if (configResult.status === 'fulfilled') {
    configData.value = configResult.value
  } else {
    configData.value = {}
    loadError.value = configResult.reason.message
  }

  schemaData.value = schemaResult.status === 'fulfilled' ? schemaResult.value : {}
  securityData.value = securityResult.status === 'fulfilled' ? securityResult.value : {}
  peersData.value = peersResult.status === 'fulfilled' ? peersResult.value : {}

  if (loadError.value) {
    message.error(`Failed to load settings page: ${loadError.value}`)
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
          <div class="text-lg font-semibold text-slate-900">Settings</div>
          <div class="mt-1 text-sm text-slate-500">Config, schema, security posture, and peers each have their own tabbed view.</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Auth Mode</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ authMode }}</div>
        <div class="mt-2 text-sm text-slate-500">Current API protection mode</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Core Protections</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ enabledCoreProtections }}</div>
        <div class="mt-2 text-sm text-slate-500">Always-on security guards</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Peers</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ peerRows.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Known wire peers</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Audit Trail</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ auditEntries }}</div>
        <div class="mt-2 text-sm text-slate-500">Recorded security events</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="config" tab="Config">
          <pre class="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{ safeJson(configData) }}</pre>
        </a-tab-pane>

        <a-tab-pane key="schema" tab="Schema">
          <pre class="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{ safeJson(schemaData) }}</pre>
        </a-tab-pane>

        <a-tab-pane key="security" tab="Security">
          <div class="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 text-base font-semibold text-slate-900">Core Protections</div>
              <div class="space-y-3">
                <div
                  v-for="row in securityCoreRows"
                  :key="row.key"
                  class="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                >
                  <span class="text-slate-700">{{ row.key }}</span>
                  <a-tag :color="row.enabled ? 'success' : 'default'">{{ row.enabled ? 'Enabled' : 'Disabled' }}</a-tag>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 text-base font-semibold text-slate-900">Configurable Controls</div>
              <a-descriptions bordered size="small" :column="1">
                <a-descriptions-item label="Rate Limiter">
                  {{ formatValue(securityData.configurable?.rate_limiter?.algorithm) }}
                </a-descriptions-item>
                <a-descriptions-item label="Tokens / Minute">
                  {{ formatValue(securityData.configurable?.rate_limiter?.tokens_per_minute) }}
                </a-descriptions-item>
                <a-descriptions-item label="Websocket Max / IP">
                  {{ formatValue(securityData.configurable?.websocket_limits?.max_per_ip) }}
                </a-descriptions-item>
                <a-descriptions-item label="WASM Timeout">
                  {{ formatValue(securityData.configurable?.wasm_sandbox?.default_timeout_secs) }}
                </a-descriptions-item>
                <a-descriptions-item label="API Key Set">
                  {{ formatValue(securityData.configurable?.auth?.api_key_set) }}
                </a-descriptions-item>
              </a-descriptions>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="peers" tab="Peers">
          <a-table
            :columns="peerColumns"
            :data-source="peerRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
