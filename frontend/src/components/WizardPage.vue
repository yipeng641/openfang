<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { getDisplayColumns, normalizeItems } from '../data-utils'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('providers')
const providersData = ref({})
const channelsData = ref({})
const agentsData = ref({})

const providerRows = computed(() => normalizeItems(providersData.value).map((provider, index) => ({
  _row_key: provider?.id || provider?.name || index,
  ...provider,
})))

const channelRows = computed(() => (channelsData.value.channels || []).map((channel) => ({
  _row_key: channel.name,
  ...channel,
})))

const agentRows = computed(() => normalizeItems(agentsData.value).map((agent, index) => ({
  _row_key: agent?.id || agent?.name || index,
  ...agent,
})))

const providerColumns = computed(() => getDisplayColumns(providerRows.value))
const agentColumns = computed(() => getDisplayColumns(agentRows.value))

const readyProviders = computed(() => providerRows.value.filter((provider) => provider.auth_status === 'configured').length)
const readyChannels = computed(() => channelRows.value.filter((channel) => channel.configured && channel.has_token).length)

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [providersResult, channelsResult, agentsResult] = await Promise.allSettled([
    apiGet('/api/providers'),
    apiGet('/api/channels'),
    apiGet('/api/agents'),
  ])

  if (providersResult.status === 'fulfilled') {
    providersData.value = providersResult.value
  } else {
    providersData.value = {}
    loadError.value = providersResult.reason.message
  }

  channelsData.value = channelsResult.status === 'fulfilled' ? channelsResult.value : {}
  agentsData.value = agentsResult.status === 'fulfilled' ? agentsResult.value : {}

  if (loadError.value) {
    message.error(`Failed to load wizard page: ${loadError.value}`)
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
          <div class="text-lg font-semibold text-slate-900">Wizard</div>
          <div class="mt-1 text-sm text-slate-500">First-run readiness is split into providers, channels, and agents for faster scanning.</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Providers</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ providerRows.length }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ readyProviders }} configured</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Channels</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ channelRows.length }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ readyChannels }} ready</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Agents</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ agentRows.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Available to route traffic</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Readiness</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">
          {{ providerRows.length + channelRows.length + agentRows.length ? Math.round(((readyProviders + readyChannels + agentRows.length) / (providerRows.length + channelRows.length + agentRows.length)) * 100) : 0 }}%
        </div>
        <div class="mt-2 text-sm text-slate-500">Simple first-run score</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="providers" :tab="`Providers (${providerRows.length})`">
          <a-table
            :columns="providerColumns"
            :data-source="providerRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          />
        </a-tab-pane>

        <a-tab-pane key="channels" :tab="`Channels (${channelRows.length})`">
          <a-table
            :columns="[
              { title: 'Channel', dataIndex: 'display_name', key: 'display_name' },
              { title: 'Category', dataIndex: 'category', key: 'category', width: 120 },
              { title: 'Configured', key: 'configured', width: 120 },
              { title: 'Token', key: 'token', width: 120 },
              { title: 'Setup Time', dataIndex: 'setup_time', key: 'setup_time', width: 120 },
            ]"
            :data-source="channelRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'configured'">
                <a-tag :color="record.configured ? 'success' : 'default'">{{ record.configured ? 'Yes' : 'No' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'token'">
                <a-tag :color="record.has_token ? 'success' : 'warning'">{{ record.has_token ? 'Present' : 'Missing' }}</a-tag>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="agents" :tab="`Agents (${agentRows.length})`">
          <a-table
            :columns="agentColumns"
            :data-source="agentRows"
            row-key="_row_key"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
