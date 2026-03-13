<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { apiDel, apiGet, apiPost, apiPut } from '../api'
import { filterSessions, formatDateTime, normalizeMemoryPairs, normalizeSessions } from '../sessions-utils'

const router = useRouter()
const activeTab = ref('sessions')
const loading = ref(false)
const memoryLoading = ref(false)
const sessionSearch = ref('')
const selectedMemoryAgentId = ref('')
const agents = ref([])
const sessions = ref([])
const memoryPairs = ref([])
const modalOpen = ref(false)
const saving = ref(false)
const formMode = ref('create')
const form = ref({ key: '', valueText: '""' })

const agentOptions = computed(() => {
  return agents.value.map((agent) => ({
    label: agent.name || agent.display_name || agent.id,
    value: agent.id,
  }))
})

const sessionRows = computed(() => normalizeSessions(sessions.value, agents.value))
const filteredSessionRows = computed(() => filterSessions(sessionRows.value, sessionSearch.value))
const memoryRows = computed(() => normalizeMemoryPairs(memoryPairs.value))

const sessionColumns = [
  { title: 'Session', dataIndex: 'sessionDisplay', key: 'sessionDisplay' },
  { title: 'Agent', dataIndex: 'agentName', key: 'agentName' },
  { title: 'Messages', dataIndex: 'messageCount', key: 'messageCount' },
  { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', customRender: ({ value }) => formatDateTime(value) },
  { title: 'Actions', key: 'actions', width: 140 },
]

const memoryColumns = [
  { title: 'Key', dataIndex: 'memoryKey', key: 'memoryKey', width: 260 },
  { title: 'Value', dataIndex: 'valueText', key: 'valueText' },
  { title: 'Actions', key: 'actions', width: 140 },
]

async function loadAgents() {
  const data = await apiGet('/api/agents')
  agents.value = Array.isArray(data) ? data : (data.agents || [])
  if (!selectedMemoryAgentId.value && agents.value.length) {
    selectedMemoryAgentId.value = agents.value[0].id
  }
}

async function loadSessions() {
  const data = await apiGet('/api/sessions')
  sessions.value = data.sessions || []
}

async function loadMemory() {
  if (!selectedMemoryAgentId.value) {
    memoryPairs.value = []
    return
  }
  memoryLoading.value = true
  try {
    const data = await apiGet(`/api/memory/agents/${encodeURIComponent(selectedMemoryAgentId.value)}/kv`)
    memoryPairs.value = data.kv_pairs || []
  } catch (error) {
    message.error(`Failed to load memory: ${error.message}`)
  } finally {
    memoryLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    await loadAgents()
    await loadSessions()
    if (activeTab.value === 'memory') {
      await loadMemory()
    }
  } catch (error) {
    message.error(`Failed to load sessions: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function openChat(session) {
  try {
    await apiPost(`/api/agents/${encodeURIComponent(session.agentId)}/sessions/${encodeURIComponent(session.sessionId)}/switch`, {})
  } catch (error) {
    message.error(`Failed to switch session: ${error.message}`)
    return
  }
  router.push('/agents')
}

async function removeSession(session) {
  if (!window.confirm(`Delete session ${session.sessionDisplay}?`)) return
  try {
    await apiDel(`/api/sessions/${encodeURIComponent(session.sessionId)}`)
    message.success('Session deleted')
    await loadSessions()
  } catch (error) {
    message.error(`Failed to delete session: ${error.message}`)
  }
}

function openCreateModal() {
  formMode.value = 'create'
  form.value = { key: '', valueText: '""' }
  modalOpen.value = true
}

function openEditModal(row) {
  formMode.value = 'edit'
  form.value = { key: row.memoryKey, valueText: row.valueText }
  modalOpen.value = true
}

async function saveMemory() {
  if (!selectedMemoryAgentId.value || !form.value.key.trim()) return
  saving.value = true
  try {
    let parsedValue
    try {
      parsedValue = JSON.parse(form.value.valueText)
    } catch {
      parsedValue = form.value.valueText
    }

    await apiPut(`/api/memory/agents/${encodeURIComponent(selectedMemoryAgentId.value)}/kv/${encodeURIComponent(form.value.key.trim())}`, {
      value: parsedValue,
    })
    message.success(formMode.value === 'create' ? 'Key added' : 'Key updated')
    modalOpen.value = false
    await loadMemory()
  } catch (error) {
    message.error(`Failed to save memory: ${error.message}`)
  } finally {
    saving.value = false
  }
}

async function removeMemory(row) {
  if (!window.confirm(`Delete key ${row.memoryKey}?`)) return
  try {
    await apiDel(`/api/memory/agents/${encodeURIComponent(selectedMemoryAgentId.value)}/kv/${encodeURIComponent(row.memoryKey)}`)
    message.success('Key deleted')
    await loadMemory()
  } catch (error) {
    message.error(`Failed to delete key: ${error.message}`)
  }
}

watch(activeTab, async (tab) => {
  if (tab === 'memory' && !memoryPairs.value.length) {
    await loadMemory()
  }
})

watch(selectedMemoryAgentId, async () => {
  if (activeTab.value === 'memory') {
    await loadMemory()
  }
})

onMounted(loadData)
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <a-tabs v-model:activeKey="activeTab" :animated="false" class="min-w-0 flex-1">
          <a-tab-pane key="sessions" tab="Sessions" />
          <a-tab-pane key="memory" tab="Memory" />
        </a-tabs>

        <div v-if="activeTab === 'sessions'" class="w-full xl:w-64">
          <a-input v-model:value="sessionSearch" allow-clear placeholder="Filter by agent..." />
        </div>

        <div v-else class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end xl:w-auto">
          <a-select v-model:value="selectedMemoryAgentId" :options="agentOptions" class="w-full sm:w-52" />
          <a-button type="primary" @click="openCreateModal">+ Add Key</a-button>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'sessions'" class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="mb-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
        <div class="text-sm font-semibold text-slate-900">Conversation Sessions</div>
        <div class="mt-1 text-xs text-slate-500">Each conversation with an agent creates a session. Sessions store the full message history so you can resume later or review past interactions.</div>
      </div>

      <a-table
        :columns="sessionColumns"
        :data-source="filteredSessionRows"
        :loading="loading"
        :pagination="{ pageSize: 10, hideOnSinglePage: true }"
        row-key="key"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'sessionDisplay'">
            <span class="font-medium text-slate-900">{{ record.sessionDisplay }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="flex gap-2">
              <a-button size="small" type="primary" @click="openChat(record)">Chat</a-button>
              <a-button size="small" danger @click="removeSession(record)">Delete</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <div v-else class="space-y-4">
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div class="text-sm font-semibold text-slate-900">Agent Memory</div>
          <div class="mt-1 text-xs text-slate-500">Each agent has its own key-value memory store. Agents use memory to persist preferences, notes, and context between conversations.</div>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="mb-3 text-xs text-slate-500">{{ memoryRows.length }} key(s)</div>
        <a-table
          :columns="memoryColumns"
          :data-source="memoryRows"
          :loading="memoryLoading"
          :pagination="{ pageSize: 8, hideOnSinglePage: true }"
          row-key="key"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'memoryKey'">
              <span class="font-medium text-slate-900">{{ record.memoryKey }}</span>
            </template>
            <template v-else-if="column.key === 'valueText'">
              <pre class="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-3 text-xs text-slate-700">{{ record.valueText }}</pre>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="flex gap-2">
                <a-button size="small" @click="openEditModal(record)">Edit</a-button>
                <a-button size="small" danger @click="removeMemory(record)">Delete</a-button>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="formMode === 'create' ? 'Add Memory Key' : 'Edit Memory Key'"
      :confirm-loading="saving"
      @ok="saveMemory"
    >
      <a-form layout="vertical">
        <a-form-item label="Key">
          <a-input v-model:value="form.key" :disabled="formMode === 'edit'" />
        </a-form-item>
        <a-form-item label="Value (JSON or text)">
          <a-textarea v-model:value="form.valueText" :rows="10" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
