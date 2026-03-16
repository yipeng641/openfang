<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('installed')
const skills = ref([])
const configuredMcpServers = ref([])
const connectedMcpServers = ref([])

const skillColumns = [
  { title: 'Skill', key: 'skill', ellipsis: true },
  { title: 'Runtime', dataIndex: 'runtime', key: 'runtime', width: 120 },
  { title: 'Source', key: 'source', width: 120 },
  { title: 'Tools', dataIndex: 'tools_count', key: 'tools_count', width: 90, align: 'center' },
  { title: 'Status', key: 'status', width: 110 },
  { title: 'Tags', key: 'tags', ellipsis: true },
]

const mcpConfiguredColumns = [
  { title: 'Server', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Transport', key: 'transport', width: 120 },
  { title: 'Timeout', dataIndex: 'timeout_secs', key: 'timeout_secs', width: 110 },
  { title: 'Env Vars', key: 'env', width: 100, align: 'center' },
]

const mcpConnectedColumns = [
  { title: 'Server', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Connected', key: 'connected', width: 110 },
  { title: 'Tools', dataIndex: 'tools_count', key: 'tools_count', width: 90, align: 'center' },
  { title: 'Tool Names', key: 'tool_names', ellipsis: true },
]

const bundledCount = computed(() => skills.value.filter((skill) => skill.source?.type === 'bundled').length)
const localCount = computed(() => skills.value.filter((skill) => !skill.source || skill.source.type === 'local').length)
const externalCount = computed(() => skills.value.filter((skill) => ['clawhub', 'openclaw'].includes(skill.source?.type)).length)
const promptOnlyCount = computed(() => skills.value.filter((skill) => String(skill.runtime).toLowerCase().includes('prompt')).length)

function sourceLabel(skill) {
  const type = skill.source?.type || 'local'
  if (type === 'bundled') return 'Built-in'
  if (type === 'clawhub') return 'ClawHub'
  if (type === 'openclaw') return 'OpenClaw'
  return 'Local'
}

function sourceColor(skill) {
  const type = skill.source?.type || 'local'
  if (type === 'bundled') return 'success'
  if (type === 'clawhub' || type === 'openclaw') return 'processing'
  return 'default'
}

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [skillsResult, mcpResult] = await Promise.allSettled([
    apiGet('/api/skills'),
    apiGet('/api/mcp/servers'),
  ])

  if (skillsResult.status === 'fulfilled') {
    skills.value = skillsResult.value.skills || []
  } else {
    skills.value = []
    loadError.value = skillsResult.reason.message
    message.error(`Failed to load skills: ${skillsResult.reason.message}`)
  }

  if (mcpResult.status === 'fulfilled') {
    configuredMcpServers.value = mcpResult.value.configured || []
    connectedMcpServers.value = mcpResult.value.connected || []
  } else {
    configuredMcpServers.value = []
    connectedMcpServers.value = []
    message.warning(`Failed to load MCP servers: ${mcpResult.reason.message}`)
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
          <div class="text-lg font-semibold text-slate-900">Skills</div>
          <div class="mt-1 text-sm text-slate-500">Installed skills and MCP integrations are separated into dedicated tabs.</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Installed</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ skills.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Total skills on disk</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Built-in</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ bundledCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Bundled with the app</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">External</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ externalCount + localCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Local or marketplace sourced</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">MCP Connected</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ connectedMcpServers.length }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ promptOnlyCount }} prompt-first skills</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="installed" :tab="`Installed Skills (${skills.length})`">
          <a-table
            :columns="skillColumns"
            :data-source="skills"
            :loading="loading"
            row-key="name"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'skill'">
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ record.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ record.description || 'No description' }}</div>
                  <div class="mt-1 text-xs text-slate-400">v{{ record.version || '-' }} <span v-if="record.author">by {{ record.author }}</span></div>
                </div>
              </template>

              <template v-else-if="column.key === 'runtime'">
                <a-tag color="blue">{{ record.runtime || 'unknown' }}</a-tag>
              </template>

              <template v-else-if="column.key === 'source'">
                <a-tag :color="sourceColor(record)">{{ sourceLabel(record) }}</a-tag>
              </template>

              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.enabled === false ? 'default' : 'success'">{{ record.enabled === false ? 'Disabled' : 'Enabled' }}</a-tag>
              </template>

              <template v-else-if="column.key === 'tags'">
                <div class="flex flex-wrap gap-1">
                  <a-tag v-for="tag in (record.tags || []).slice(0, 4)" :key="tag">{{ tag }}</a-tag>
                  <span v-if="!record.tags || !record.tags.length" class="text-xs text-slate-400">No tags</span>
                </div>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="mcp" :tab="`MCP Servers (${configuredMcpServers.length}/${connectedMcpServers.length})`">
          <div class="grid gap-4 xl:grid-cols-2">
            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <div class="text-base font-semibold text-slate-900">Configured Servers</div>
                  <div class="mt-1 text-sm text-slate-500">Entries declared in config.</div>
                </div>
                <a-tag color="blue">{{ configuredMcpServers.length }}</a-tag>
              </div>

              <a-table
                :columns="mcpConfiguredColumns"
                :data-source="configuredMcpServers"
                :pagination="{ pageSize: 6, hideOnSinglePage: true }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'transport'">
                    <a-tag>{{ record.transport?.type || '-' }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'env'">
                    {{ Object.keys(record.env || {}).length }}
                  </template>
                </template>
              </a-table>
            </div>

            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <div class="text-base font-semibold text-slate-900">Connected Servers</div>
                  <div class="mt-1 text-sm text-slate-500">Live MCP connections and exposed tools.</div>
                </div>
                <a-tag color="success">{{ connectedMcpServers.length }}</a-tag>
              </div>

              <a-table
                :columns="mcpConnectedColumns"
                :data-source="connectedMcpServers"
                :pagination="{ pageSize: 6, hideOnSinglePage: true }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'connected'">
                    <a-tag :color="record.connected ? 'success' : 'default'">{{ record.connected ? 'Connected' : 'Offline' }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'tool_names'">
                    <div class="text-xs text-slate-600">
                      {{ (record.tools || []).slice(0, 3).map((tool) => tool.name).join(', ') || 'No tools reported' }}
                    </div>
                  </template>
                </template>
              </a-table>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
