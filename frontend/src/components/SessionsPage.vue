<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue, normalizeItems, safeJson } from '../data-utils'

const loading = ref(false)
const agents = ref([])
const sessions = ref([])
const currentSession = ref(null)
const selectedAgentId = ref('')

const selectedAgent = computed(() => agents.value.find((agent) => String(agent.id) === String(selectedAgentId.value)) || null)

async function loadAgents() {
  const data = await apiGet('/api/agents')
  agents.value = normalizeItems(data)
  if (!selectedAgentId.value && agents.value.length) {
    selectedAgentId.value = agents.value[0].id
  }
}

async function loadSessions() {
  if (!selectedAgentId.value) {
    sessions.value = []
    currentSession.value = null
    return
  }
  try {
    const [sessionsData, currentData] = await Promise.all([
      apiGet(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/sessions`).catch(() => []),
      apiGet(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/session`).catch(() => null),
    ])
    sessions.value = normalizeItems(sessionsData)
    currentSession.value = currentData
  } catch (error) {
    message.error(`Failed to load sessions: ${error.message}`)
  }
}

async function loadData() {
  loading.value = true
  try {
    await loadAgents()
    await loadSessions()
  } catch (error) {
    message.error(`Failed to load session data: ${error.message}`)
  } finally {
    loading.value = false
  }
}

watch(selectedAgentId, loadSessions)
onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Sessions</div>
          <div class="mt-1 text-sm text-slate-500">Inspect agent sessions and the active conversation snapshot.</div>
        </div>
        <div class="flex items-center gap-3">
          <a-select v-model:value="selectedAgentId" class="w-72" placeholder="Select agent">
            <a-select-option v-for="agent in agents" :key="agent.id" :value="agent.id">
              {{ agent.name || agent.display_name || agent.id }}
            </a-select-option>
          </a-select>
          <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
        </div>
      </div>
    </div>

    <a-row :gutter="16">
      <a-col :xs="24" :xl="10" class="mb-4">
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 text-base font-semibold text-slate-900">{{ selectedAgent?.name || selectedAgent?.id || 'Agent Sessions' }}</div>
          <a-list :data-source="sessions" bordered>
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="w-full">
                  <div class="font-medium text-slate-900">{{ item.title || item.id || item.session_id || 'Session' }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ formatValue(item.updated_at || item.created_at) }}</div>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </a-col>

      <a-col :xs="24" :xl="14" class="mb-4">
        <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 text-base font-semibold text-slate-900">Current Session Snapshot</div>
          <pre class="max-h-[640px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{ safeJson(currentSession) }}</pre>
        </div>
      </a-col>
    </a-row>
  </div>
</template>
