<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  CalendarOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import { apiDel, apiGet, apiPost, apiPut } from '../api'
import { formatValue } from '../data-utils'

// ─── state ───────────────────────────────────────────────────────────────────
const loading = ref(false)
const jobs = ref([])
const agents = ref([])
const search = ref('')
const activeTab = ref('jobs')
const acting = ref('')

// create modal
const createOpen = ref(false)
const saving = ref(false)
const form = ref({
  name: '',
  cron_expr: '0 9 * * 1-5',
  agent_id: '',
  agent_message: '',
  enabled: true,
})

// ─── computed ────────────────────────────────────────────────────────────────
const filteredJobs = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return jobs.value
  return jobs.value.filter((j) =>
    [j.name, j.agent_id, cronDisplayText(j)]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
})

const activeCount = computed(() => jobs.value.filter((j) => j.enabled).length)

const cronPresets = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day 9am', value: '0 9 * * *' },
  { label: 'Weekdays 9am', value: '0 9 * * 1-5' },
]

const jobColumns = [
  { title: 'Name', key: 'name' },
  { title: 'Schedule', key: 'schedule', width: 200 },
  { title: 'Agent', key: 'agent', width: 180 },
  { title: 'Status', key: 'status', width: 100 },
  { title: 'Last Run', key: 'last_run', width: 160 },
  { title: 'Next Run', key: 'next_run', width: 160 },
  { title: 'Actions', key: 'actions', width: 200 },
]

// ─── helpers ─────────────────────────────────────────────────────────────────
function cronDisplayText(job) {
  if (!job.schedule) return '—'
  const s = job.schedule
  if (s.kind === 'cron') return s.expr || '—'
  if (s.kind === 'every') return `Every ${s.every_secs}s`
  if (s.kind === 'at') return `Once at ${formatValue(s.at)}`
  return JSON.stringify(s)
}

function cronHumanLabel(job) {
  if (!job.schedule) return ''
  const s = job.schedule
  if (s.kind === 'every') {
    const secs = s.every_secs
    if (secs < 120) return `Every ${secs} seconds`
    if (secs < 7200) return `Every ${Math.round(secs / 60)} minutes`
    return `Every ${Math.round(secs / 3600)} hours`
  }
  if (s.kind === 'cron') {
    const expr = s.expr || ''
    const match = cronPresets.find((p) => p.value === expr)
    if (match) return match.label
    return ''
  }
  return ''
}

function agentName(job) {
  if (!job.agent_id) return '—'
  const agent = agents.value.find((a) => a.id === job.agent_id || a.id === job.agent_id?.toString?.())
  return agent?.name || job.agent_id.substring(0, 8) + '...'
}

function relativeTime(dateStr) {
  if (!dateStr) return 'never'
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = d - now
  const abs = Math.abs(diff)
  if (abs < 60_000) return diff > 0 ? 'in <1m' : '<1m ago'
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000)
    return diff > 0 ? `in ${m}m` : `${m}m ago`
  }
  if (abs < 86_400_000) {
    const hrs = Math.round(abs / 3_600_000)
    return diff > 0 ? `in ${hrs}h` : `${hrs}h ago`
  }
  return formatValue(dateStr)
}

// ─── api ─────────────────────────────────────────────────────────────────────
async function loadJobs() {
  loading.value = true
  try {
    const data = await apiGet('/api/cron/jobs')
    jobs.value = data.jobs || []
  } catch (error) {
    message.error(`Failed to load jobs: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function loadAgents() {
  try {
    const data = await apiGet('/api/agents')
    agents.value = Array.isArray(data) ? data : data.agents || []
  } catch {
    agents.value = []
  }
}

// ─── create ──────────────────────────────────────────────────────────────────
function openCreate() {
  form.value = { name: '', cron_expr: '0 9 * * 1-5', agent_id: '', agent_message: '', enabled: true }
  createOpen.value = true
}

function applyPreset(value) {
  form.value.cron_expr = value
}

async function handleCreate() {
  const { name, cron_expr, agent_id, agent_message, enabled } = form.value
  if (!name.trim()) {
    message.error('Job name is required')
    return
  }
  if (!agent_id) {
    message.error('Target agent is required')
    return
  }
  if (!agent_message.trim()) {
    message.error('Message is required')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: name.trim(),
      agent_id,
      schedule: { kind: 'cron', expr: cron_expr.trim() },
      action: { kind: 'agent_turn', message: agent_message.trim() },
      enabled,
    }
    await apiPost('/api/cron/jobs', payload)
    message.success(`Schedule "${name}" created`)
    createOpen.value = false
    await loadJobs()
  } catch (error) {
    message.error(`Failed to create job: ${error.message}`)
  } finally {
    saving.value = false
  }
}

// ─── actions ─────────────────────────────────────────────────────────────────
async function toggleJob(record) {
  const newEnabled = !record.enabled
  acting.value = `toggle:${record.id}`
  try {
    await apiPut(`/api/cron/jobs/${encodeURIComponent(record.id)}/enable`, {
      enabled: newEnabled,
    })
    message.success(`Job ${newEnabled ? 'enabled' : 'paused'}`)
    await loadJobs()
  } catch (error) {
    message.error(`Failed to toggle job: ${error.message}`)
  } finally {
    acting.value = ''
  }
}

async function runNow(record) {
  acting.value = `run:${record.id}`
  try {
    // Send message to agent directly to simulate "Run Now"
    const agentId = typeof record.agent_id === 'object' ? record.agent_id.toString() : record.agent_id
    const msg = record.action?.message || 'Triggered by scheduler'
    await apiPost(`/api/agents/${encodeURIComponent(agentId)}/message`, { message: msg })
    message.success('Job triggered')
  } catch (error) {
    message.error(`Failed to trigger job: ${error.message}`)
  } finally {
    acting.value = ''
  }
}

function confirmDelete(record) {
  Modal.confirm({
    title: 'Delete Job',
    content: `Delete scheduled job "${record.name}"? This cannot be undone.`,
    okText: 'Delete',
    okType: 'danger',
    async onOk() {
      try {
        await apiDel(`/api/cron/jobs/${encodeURIComponent(record.id)}`)
        message.success(`Deleted "${record.name}"`)
        await loadJobs()
      } catch (error) {
        message.error(`Failed to delete: ${error.message}`)
      }
    },
  })
}

onMounted(() => {
  loadJobs()
  loadAgents()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Scheduler</div>
          <div class="mt-0.5 text-sm text-slate-500">
            Create cron-based scheduled jobs that send messages to agents on a recurring schedule.
          </div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search..." class="w-full sm:w-56">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div class="flex gap-2">
            <a-button :icon="h(ReloadOutlined)" @click="loadJobs">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="openCreate">New Job</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <a-tabs v-model:activeKey="activeTab">
      <a-tab-pane key="jobs">
        <template #tab>
          <span>Scheduled Jobs</span>
          <a-tag v-if="activeCount > 0" color="green" class="ml-2">{{ activeCount }} Active</a-tag>
        </template>

        <!-- Info card -->
        <div class="mb-4 rounded-2xl border-l-4 border-orange-400 bg-orange-50 p-4 shadow-sm">
          <div class="font-semibold text-slate-800">Scheduled Jobs</div>
          <div class="mt-1 text-sm text-slate-600">
            Create cron-based scheduled jobs that send messages to agents on a recurring schedule.
            Use cron expressions like
            <code class="rounded bg-white px-1 py-0.5 text-orange-600">*/5 * * * *</code> (every 5 min)
            or
            <code class="rounded bg-white px-1 py-0.5 text-orange-600">0 9 * * 1-5</code> (weekdays at 9am).
            You can also run any job manually with the "Run" button.
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-if="!loading && filteredJobs.length === 0"
          class="flex flex-col items-center gap-4 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200"
        >
          <CalendarOutlined class="text-5xl text-orange-300" />
          <div class="text-lg font-semibold text-slate-700">No scheduled jobs yet</div>
          <div class="max-w-sm text-center text-sm text-slate-500">
            Schedule recurring agent tasks with cron expressions.
          </div>
          <a-button type="primary" @click="openCreate">Create Schedule</a-button>
        </div>

        <!-- Table -->
        <div v-else class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <a-table
            :columns="jobColumns"
            :data-source="filteredJobs"
            :loading="loading"
            :pagination="{ pageSize: 15 }"
            row-key="id"
            size="middle"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="font-medium text-slate-900">{{ record.name }}</div>
                <div class="text-xs text-slate-400">{{ typeof record.id === 'string' ? record.id.substring(0, 8) : record.id }}</div>
              </template>

              <template v-else-if="column.key === 'schedule'">
                <div class="font-mono text-sm text-orange-600">{{ cronDisplayText(record) }}</div>
                <div v-if="cronHumanLabel(record)" class="text-xs text-slate-400">
                  {{ cronHumanLabel(record) }}
                </div>
              </template>

              <template v-else-if="column.key === 'agent'">
                {{ agentName(record) }}
              </template>

              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.enabled ? 'success' : 'default'">
                  {{ record.enabled ? 'Active' : 'Paused' }}
                </a-tag>
              </template>

              <template v-else-if="column.key === 'last_run'">
                {{ relativeTime(record.last_run) }}
              </template>

              <template v-else-if="column.key === 'next_run'">
                {{ relativeTime(record.next_run) }}
              </template>

              <template v-else-if="column.key === 'actions'">
                <div class="flex gap-1">
                  <a-button
                    type="primary"
                    size="small"
                    :loading="acting === `run:${record.id}`"
                    @click="runNow(record)"
                  >Run</a-button>
                  <a-button
                    size="small"
                    :loading="acting === `toggle:${record.id}`"
                    @click="toggleJob(record)"
                  >{{ record.enabled ? 'Pause' : 'Resume' }}</a-button>
                  <a-button size="small" danger @click="confirmDelete(record)">Del</a-button>
                </div>
              </template>
            </template>
          </a-table>
        </div>
      </a-tab-pane>

      <a-tab-pane key="triggers" tab="Event Triggers">
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200">
          <ThunderboltOutlined class="text-5xl text-slate-300" />
          <div class="text-lg font-semibold text-slate-600">Event Triggers</div>
          <div class="text-sm text-slate-400">Webhook-based event triggers coming soon.</div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="history" tab="Run History">
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200">
          <CalendarOutlined class="text-5xl text-slate-300" />
          <div class="text-lg font-semibold text-slate-600">Run History</div>
          <div class="text-sm text-slate-400">Execution history and logs coming soon.</div>
        </div>
      </a-tab-pane>
    </a-tabs>

    <!-- Create Job Modal -->
    <a-modal
      v-model:open="createOpen"
      title="Create Scheduled Job"
      :confirm-loading="saving"
      ok-text="Create Schedule"
      width="580px"
      @ok="handleCreate"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item label="Job Name" required>
          <a-input v-model:value="form.name" placeholder="daily-report" />
        </a-form-item>

        <a-form-item label="Cron Expression" required>
          <a-input v-model:value="form.cron_expr" placeholder="0 9 * * 1-5" class="font-mono" />
          <div class="mt-1 text-xs text-slate-400">
            Format: minute hour day-of-month month day-of-week
          </div>
        </a-form-item>

        <div class="mb-4">
          <div class="mb-1 text-xs font-medium text-slate-500">Quick Presets</div>
          <div class="flex flex-wrap gap-1.5">
            <a-button
              v-for="preset in cronPresets"
              :key="preset.value"
              size="small"
              :type="form.cron_expr === preset.value ? 'primary' : 'default'"
              @click="applyPreset(preset.value)"
            >
              {{ preset.label }}
            </a-button>
          </div>
        </div>

        <a-form-item label="Target Agent" required>
          <a-select
            v-model:value="form.agent_id"
            placeholder="Select an agent"
            show-search
            :filter-option="(input, option) => (option.label || '').toLowerCase().includes(input.toLowerCase())"
            :options="agents.map((a) => ({ value: a.id, label: a.name || a.id }))"
          />
        </a-form-item>

        <a-form-item label="Message to Send" required>
          <a-textarea
            v-model:value="form.agent_message"
            :rows="3"
            placeholder="Generate and email the daily status report..."
          />
          <div class="mt-1 text-xs text-orange-500">
            The message sent to the agent each time this job runs.
          </div>
        </a-form-item>

        <div class="flex items-center gap-3">
          <a-switch v-model:checked="form.enabled" />
          <span class="text-sm font-medium" :class="form.enabled ? 'text-orange-600' : 'text-slate-500'">
            {{ form.enabled ? 'Enabled (will start running immediately)' : 'Disabled (create paused)' }}
          </span>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>
