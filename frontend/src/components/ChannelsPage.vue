<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('all')
const search = ref('')
const channels = ref([])
const configuredCount = ref(0)

const channelColumns = [
  { title: 'Channel', key: 'channel', ellipsis: true },
  { title: 'Category', dataIndex: 'category', key: 'category', width: 120 },
  { title: 'Status', key: 'status', width: 140 },
  { title: 'Setup', key: 'setup', width: 160 },
  { title: 'Quick Setup', dataIndex: 'quick_setup', key: 'quick_setup', ellipsis: true },
  { title: 'Fields', key: 'fields', width: 120 },
]

const filteredChannels = computed(() => {
  const query = search.value.trim().toLowerCase()

  return channels.value.filter((channel) => {
    if (activeTab.value === 'configured' && !channel.configured) return false
    if (activeTab.value === 'attention' && channel.configured && channel.has_token) return false

    if (!query) return true

    return [
      channel.name,
      channel.display_name,
      channel.description,
      channel.category,
      channel.quick_setup,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

const readyCount = computed(() => channels.value.filter((channel) => channel.configured && channel.has_token).length)
const needsSetupCount = computed(() => channels.value.filter((channel) => !channel.configured).length)
const missingTokenCount = computed(() => channels.value.filter((channel) => channel.configured && !channel.has_token).length)
const categorySummary = computed(() => {
  const counts = new Map()
  for (const channel of channels.value) {
    const current = counts.get(channel.category) || 0
    counts.set(channel.category, current + 1)
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count)
})

function statusMeta(channel) {
  if (!channel.configured) {
    return { color: 'default', text: 'Not Configured' }
  }
  if (!channel.has_token) {
    return { color: 'warning', text: 'Missing Token' }
  }
  return { color: 'success', text: 'Ready' }
}

function fieldSummary(channel) {
  const fields = Array.isArray(channel.fields) ? channel.fields : []
  const required = fields.filter((field) => field.required).length
  return `${required}/${fields.length}`
}

async function loadChannels() {
  loading.value = true
  loadError.value = ''

  try {
    const data = await apiGet('/api/channels')
    channels.value = data.channels || []
    configuredCount.value = data.configured_count || 0
  } catch (error) {
    channels.value = []
    configuredCount.value = 0
    loadError.value = error.message
    message.error(`Failed to load channels: ${error.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadChannels)
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Channels</div>
          <div class="mt-1 text-sm text-slate-500">View channel readiness, setup guidance, and channels that still need attention.</div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a-input-search
            v-model:value="search"
            allow-clear
            placeholder="Search channels"
            class="w-full sm:w-72"
          />
          <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadChannels">Refresh</a-button>
        </div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ channels.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Registered adapters</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Configured</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ configuredCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Saved channel setups</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ready</div>
        <div class="mt-3 text-3xl font-semibold text-emerald-600">{{ readyCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Configured and token present</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Attention</div>
        <div class="mt-3 text-3xl font-semibold text-amber-600">{{ needsSetupCount + missingTokenCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Needs setup or token repair</div>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="all" :tab="`All (${channels.length})`" />
          <a-tab-pane key="configured" :tab="`Configured (${configuredCount})`" />
          <a-tab-pane key="attention" :tab="`Needs Attention (${needsSetupCount + missingTokenCount})`" />
        </a-tabs>

        <a-table
          :columns="channelColumns"
          :data-source="filteredChannels"
          :loading="loading"
          row-key="name"
          :pagination="{ pageSize: 10, hideOnSinglePage: true }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'channel'">
              <div class="flex items-start gap-3">
                <a-tag color="blue">{{ record.icon || record.name?.slice(0, 2)?.toUpperCase() }}</a-tag>
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ record.display_name || record.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ record.description }}</div>
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'category'">
              <span class="capitalize">{{ record.category }}</span>
            </template>

            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusMeta(record).color">{{ statusMeta(record).text }}</a-tag>
            </template>

            <template v-else-if="column.key === 'setup'">
              <div class="text-sm text-slate-700">{{ record.setup_time || '-' }}</div>
              <div class="mt-1 text-xs text-slate-500">{{ record.difficulty || 'Unknown' }}</div>
            </template>

            <template v-else-if="column.key === 'fields'">
              <div class="text-sm font-medium text-slate-900">{{ fieldSummary(record) }}</div>
              <div class="mt-1 text-xs text-slate-500">required/total</div>
            </template>
          </template>
        </a-table>
      </div>

      <div class="space-y-4">
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-base font-semibold text-slate-900">Status Breakdown</div>
          <div class="mt-4 space-y-4">
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Ready</span>
                <span class="font-medium text-slate-900">{{ readyCount }}</span>
              </div>
              <a-progress :percent="channels.length ? Math.round((readyCount / channels.length) * 100) : 0" :show-info="false" stroke-color="#10b981" />
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Missing Token</span>
                <span class="font-medium text-slate-900">{{ missingTokenCount }}</span>
              </div>
              <a-progress :percent="channels.length ? Math.round((missingTokenCount / channels.length) * 100) : 0" :show-info="false" stroke-color="#f59e0b" />
            </div>
            <div>
              <div class="mb-2 flex items-center justify-between text-sm">
                <span class="text-slate-600">Not Configured</span>
                <span class="font-medium text-slate-900">{{ needsSetupCount }}</span>
              </div>
              <a-progress :percent="channels.length ? Math.round((needsSetupCount / channels.length) * 100) : 0" :show-info="false" stroke-color="#94a3b8" />
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="text-base font-semibold text-slate-900">Categories</div>
          <div class="mt-4 space-y-3">
            <div
              v-for="item in categorySummary"
              :key="item.category"
              class="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
            >
              <span class="capitalize text-slate-700">{{ item.category }}</span>
              <span class="font-medium text-slate-900">{{ item.count }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
