<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue } from '../data-utils'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('catalog')
const hands = ref([])
const instances = ref([])
const detailOpen = ref(false)
const detailLoading = ref(false)
const selectedHand = ref(null)

const handColumns = [
  { title: 'Hand', key: 'hand', ellipsis: true },
  { title: 'Category', dataIndex: 'category', key: 'category', width: 130 },
  { title: 'Requirements', key: 'requirements', width: 130 },
  { title: 'Tools', key: 'tools', width: 90, align: 'center' },
  { title: 'Settings', key: 'settings', width: 100, align: 'center' },
  { title: 'Status', key: 'status', width: 130 },
  { title: 'Action', key: 'action', width: 110 },
]

const instanceColumns = [
  { title: 'Instance', dataIndex: 'instance_id', key: 'instance_id', ellipsis: true },
  { title: 'Hand', dataIndex: 'hand_id', key: 'hand_id', width: 140 },
  { title: 'Status', dataIndex: 'status', key: 'status', width: 120 },
  { title: 'Agent', dataIndex: 'agent_name', key: 'agent_name', ellipsis: true },
  { title: 'Activated', dataIndex: 'activated_at', key: 'activated_at', width: 190 },
  { title: 'Updated', dataIndex: 'updated_at', key: 'updated_at', width: 190 },
]

const readyCount = computed(() => hands.value.filter((hand) => hand.requirements_met).length)
const activeCount = computed(() => hands.value.filter((hand) => hand.active).length)
const degradedCount = computed(() => hands.value.filter((hand) => hand.degraded).length)
const needsSetupCount = computed(() => hands.value.filter((hand) => !hand.requirements_met).length)

function handStatus(hand) {
  if (hand.degraded) return { color: 'warning', text: 'Degraded' }
  if (hand.active) return { color: 'success', text: 'Active' }
  if (hand.requirements_met) return { color: 'processing', text: 'Ready' }
  return { color: 'default', text: 'Setup Needed' }
}

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [handsResult, activeResult] = await Promise.allSettled([
    apiGet('/api/hands'),
    apiGet('/api/hands/active'),
  ])

  if (handsResult.status === 'fulfilled') {
    hands.value = handsResult.value.hands || []
  } else {
    hands.value = []
    loadError.value = handsResult.reason.message
    message.error(`Failed to load hands: ${handsResult.reason.message}`)
  }

  if (activeResult.status === 'fulfilled') {
    instances.value = activeResult.value.instances || []
  } else {
    instances.value = []
    message.warning(`Failed to load active hands: ${activeResult.reason.message}`)
  }

  loading.value = false
}

async function openHandDetail(handId) {
  detailOpen.value = true
  detailLoading.value = true
  selectedHand.value = null

  try {
    selectedHand.value = await apiGet(`/api/hands/${encodeURIComponent(handId)}`)
  } catch (error) {
    message.error(`Failed to load hand detail: ${error.message}`)
  } finally {
    detailLoading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-slate-900">Hands</div>
          <div class="mt-1 text-sm text-slate-500">Review available hands, runtime readiness, and active hand instances in separate tabs.</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Catalog</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ hands.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Installed hand definitions</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ready</div>
        <div class="mt-3 text-3xl font-semibold text-emerald-600">{{ readyCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Requirements satisfied</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Active</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ activeCount || instances.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Running hand instances</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Attention</div>
        <div class="mt-3 text-3xl font-semibold text-amber-600">{{ degradedCount + needsSetupCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Degraded or missing requirements</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="catalog" :tab="`Catalog (${hands.length})`">
          <a-table
            :columns="handColumns"
            :data-source="hands"
            :loading="loading"
            row-key="id"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'hand'">
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">
                    {{ record.icon || 'H' }}
                  </div>
                  <div class="min-w-0">
                    <div class="truncate font-medium text-slate-900">{{ record.name || record.id }}</div>
                    <div class="mt-1 text-xs text-slate-500">{{ record.description }}</div>
                  </div>
                </div>
              </template>

              <template v-else-if="column.key === 'category'">
                <span class="capitalize">{{ record.category || '-' }}</span>
              </template>

              <template v-else-if="column.key === 'requirements'">
                {{ (record.requirements || []).filter((item) => item.satisfied).length }}/{{ (record.requirements || []).length }}
              </template>

              <template v-else-if="column.key === 'tools'">
                {{ (record.tools || []).length }}
              </template>

              <template v-else-if="column.key === 'settings'">
                {{ record.settings_count || 0 }}
              </template>

              <template v-else-if="column.key === 'status'">
                <a-tag :color="handStatus(record).color">{{ handStatus(record).text }}</a-tag>
              </template>

              <template v-else-if="column.key === 'action'">
                <a-button type="link" size="small" @click="openHandDetail(record.id)">Inspect</a-button>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="active" :tab="`Active Instances (${instances.length})`">
          <a-table
            :columns="instanceColumns"
            :data-source="instances"
            :loading="loading"
            row-key="instance_id"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 'running' ? 'success' : 'default'">{{ record.status }}</a-tag>
              </template>
              <template v-else-if="column.key === 'agent_name'">
                {{ record.agent_name || '-' }}
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </div>

    <a-drawer
      v-model:open="detailOpen"
      title="Hand Detail"
      width="640"
      :destroy-on-close="true"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="selectedHand" class="space-y-5">
          <div class="rounded-2xl border border-slate-100 p-4">
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                {{ selectedHand.icon || 'H' }}
              </div>
              <div class="min-w-0">
                <div class="text-lg font-semibold text-slate-900">{{ selectedHand.name || selectedHand.id }}</div>
                <div class="mt-1 text-sm text-slate-500">{{ selectedHand.description }}</div>
              </div>
            </div>
          </div>

          <a-tabs default-active-key="requirements">
            <a-tab-pane key="requirements" tab="Requirements">
              <a-table
                :columns="[
                  { title: 'Requirement', dataIndex: 'label', key: 'label' },
                  { title: 'Type', dataIndex: 'type', key: 'type', width: 120 },
                  { title: 'Satisfied', key: 'satisfied', width: 120 },
                  { title: 'Optional', key: 'optional', width: 100 },
                ]"
                :data-source="selectedHand.requirements || []"
                :pagination="false"
                row-key="key"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'satisfied'">
                    <a-tag :color="record.satisfied ? 'success' : 'warning'">{{ record.satisfied ? 'Yes' : 'No' }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'optional'">
                    <a-tag :color="record.optional ? 'default' : 'blue'">{{ record.optional ? 'Optional' : 'Required' }}</a-tag>
                  </template>
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="settings" tab="Settings">
              <a-table
                :columns="[
                  { title: 'Key', dataIndex: 'key', key: 'key' },
                  { title: 'Label', dataIndex: 'label', key: 'label' },
                  { title: 'Type', dataIndex: 'type', key: 'type', width: 120 },
                  { title: 'Default', key: 'default', ellipsis: true },
                ]"
                :data-source="selectedHand.settings || []"
                :pagination="false"
                row-key="key"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'default'">
                    {{ formatValue(record.default) }}
                  </template>
                </template>
              </a-table>
            </a-tab-pane>

            <a-tab-pane key="agent" tab="Agent">
              <a-descriptions bordered :column="1" size="small">
                <a-descriptions-item label="Name">{{ selectedHand.agent?.name || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Description">{{ selectedHand.agent?.description || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Provider">{{ selectedHand.agent?.provider || '-' }}</a-descriptions-item>
                <a-descriptions-item label="Model">{{ selectedHand.agent?.model || '-' }}</a-descriptions-item>
              </a-descriptions>
            </a-tab-pane>
          </a-tabs>
        </div>
      </a-spin>
    </a-drawer>
  </div>
</template>
