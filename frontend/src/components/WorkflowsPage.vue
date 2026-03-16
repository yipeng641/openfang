<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  CaretRightOutlined,
  CloseOutlined,
  ClusterOutlined,
  DeleteOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../api'
import { formatValue } from '../data-utils'

// ─── state ───────────────────────────────────────────────────────────────────
const loading = ref(false)
const workflows = ref([])
const agents = ref([])
const search = ref('')
const viewMode = ref('list') // 'list' | 'builder'

// create modal
const createOpen = ref(false)
const saving = ref(false)
const form = ref({ name: '', description: '', steps: [] })

// run modal
const runOpen = ref(false)
const runInput = ref('')
const running = ref('')

// run history
const historyOpen = ref(false)
const historyWorkflow = ref(null)
const historyLoading = ref(false)
const runs = ref([])

// ─── computed ────────────────────────────────────────────────────────────────
const filteredWorkflows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return workflows.value
  return workflows.value.filter((w) =>
    [w.name, w.description, w.id].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
  )
})

const stepModes = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'fan_out', label: 'Fan Out' },
  { value: 'collect', label: 'Collect' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'loop', label: 'Loop' },
]

const columns = [
  { title: 'Name', key: 'name', ellipsis: true },
  { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: 'Steps', dataIndex: 'steps', key: 'steps', width: 80, align: 'center' },
  { title: 'Created', dataIndex: 'created_at', key: 'created_at', width: 180, customRender: ({ value }) => formatValue(value) },
  { title: 'Actions', key: 'actions', width: 200 },
]

const runColumns = [
  { title: 'Run ID', dataIndex: 'id', key: 'id', ellipsis: true },
  { title: 'Workflow', dataIndex: 'workflow_name', key: 'workflow_name' },
  { title: 'State', dataIndex: 'state', key: 'state', width: 120 },
  { title: 'Steps Done', dataIndex: 'steps_completed', key: 'steps_completed', width: 100, align: 'center' },
  { title: 'Started', dataIndex: 'started_at', key: 'started_at', width: 180, customRender: ({ value }) => formatValue(value) },
  { title: 'Completed', dataIndex: 'completed_at', key: 'completed_at', width: 180, customRender: ({ value }) => formatValue(value) },
]

// ─── api ─────────────────────────────────────────────────────────────────────
async function loadWorkflows() {
  loading.value = true
  try {
    const data = await apiGet('/api/workflows')
    workflows.value = Array.isArray(data) ? data : []
  } catch (error) {
    message.error(`Failed to load workflows: ${error.message}`)
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
  form.value = {
    name: '',
    description: '',
    steps: [{ name: '', agent_name: '', mode: 'sequential', prompt: '{{input}}' }],
  }
  createOpen.value = true
}

function addStep() {
  form.value.steps.push({ name: '', agent_name: '', mode: 'sequential', prompt: '{{input}}' })
}

function removeStep(index) {
  form.value.steps.splice(index, 1)
}

async function handleCreate() {
  const { name, description, steps } = form.value
  if (!name.trim()) {
    message.error('Workflow name is required')
    return
  }
  if (!steps.length) {
    message.error('At least one step is required')
    return
  }
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i].agent_name.trim()) {
      message.error(`Step #${i + 1} needs an agent name`)
      return
    }
  }

  saving.value = true
  try {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((s) => ({
        name: s.name.trim() || `step-${steps.indexOf(s) + 1}`,
        agent_name: s.agent_name.trim(),
        mode: s.mode,
        prompt: s.prompt || '{{input}}',
      })),
    }
    await apiPost('/api/workflows', payload)
    message.success(`Workflow "${name}" created`)
    createOpen.value = false
    await loadWorkflows()
  } catch (error) {
    message.error(`Failed to create workflow: ${error.message}`)
  } finally {
    saving.value = false
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────
function openRun(record) {
  running.value = record.id
  runInput.value = ''
  runOpen.value = true
}

async function handleRun() {
  if (!running.value) return
  const id = running.value
  runOpen.value = false

  try {
    message.loading({ content: 'Running workflow...', key: 'wf-run', duration: 0 })
    const result = await apiPost(`/api/workflows/${encodeURIComponent(id)}/run`, {
      input: runInput.value,
    })
    message.success({ content: `Workflow completed — ${result.status || 'done'}`, key: 'wf-run' })
  } catch (error) {
    message.error({ content: `Workflow failed: ${error.message}`, key: 'wf-run' })
  } finally {
    running.value = ''
  }
}

// ─── history ─────────────────────────────────────────────────────────────────
async function openHistory(record) {
  historyWorkflow.value = record
  historyOpen.value = true
  historyLoading.value = true
  try {
    const data = await apiGet(`/api/workflows/${encodeURIComponent(record.id)}/runs`)
    runs.value = Array.isArray(data) ? data : []
  } catch (error) {
    message.error(`Failed to load run history: ${error.message}`)
    runs.value = []
  } finally {
    historyLoading.value = false
  }
}

function stateColor(state) {
  if (!state) return 'default'
  const s = typeof state === 'string' ? state : JSON.stringify(state)
  if (s.includes('completed') || s.includes('Completed')) return 'success'
  if (s.includes('running') || s.includes('Running')) return 'processing'
  if (s.includes('failed') || s.includes('Failed')) return 'error'
  return 'default'
}

function stateText(state) {
  if (!state) return 'unknown'
  return typeof state === 'string' ? state : JSON.stringify(state)
}

onMounted(() => {
  loadWorkflows()
  loadAgents()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Workflows</div>
          <div class="mt-0.5 text-sm text-slate-500">
            Chain multiple agents into automated pipelines with branching, fan-out, and loops.
          </div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search..." class="w-full sm:w-56">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div class="flex gap-2">
            <a-radio-group v-model:value="viewMode" size="small" button-style="solid">
              <a-radio-button value="list">List</a-radio-button>
              <a-radio-button value="builder">Visual Builder</a-radio-button>
            </a-radio-group>
            <a-button :icon="h(ReloadOutlined)" @click="loadWorkflows">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="openCreate">New Workflow</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info card -->
    <div class="rounded-2xl border-l-4 border-orange-400 bg-orange-50 p-4 shadow-sm">
      <div class="font-semibold text-slate-800">What are Workflows?</div>
      <div class="mt-1 text-sm text-slate-600">
        Workflows chain multiple agents into automated pipelines. Each step runs an agent with a prompt template,
        passing output from one step as input to the next. Steps can run sequentially, fan out in parallel, loop,
        or branch conditionally.
        <span class="cursor-pointer font-medium text-orange-600" @click="viewMode = 'builder'">
          Try the Visual Builder
        </span>
        to drag and drop workflow steps.
      </div>
    </div>

    <!-- List view -->
    <template v-if="viewMode === 'list'">
      <!-- Empty state -->
      <div
        v-if="!loading && filteredWorkflows.length === 0"
        class="flex flex-col items-center gap-4 rounded-2xl bg-white py-16 shadow-sm ring-1 ring-slate-200"
      >
        <ClusterOutlined class="text-5xl text-orange-300" />
        <div class="text-lg font-semibold text-slate-700">No workflows yet</div>
        <div class="max-w-sm text-center text-sm text-slate-500">
          Chain multiple agents into automated pipelines with branching, fan-out, and loops.
        </div>
        <a-button type="primary" @click="openCreate">Create Workflow</a-button>
      </div>

      <!-- Table -->
      <div v-else class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <a-table
          :columns="columns"
          :data-source="filteredWorkflows"
          :loading="loading"
          :pagination="{ pageSize: 15 }"
          row-key="id"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="font-medium text-slate-900">{{ record.name }}</div>
              <div class="text-xs text-slate-400">{{ record.id }}</div>
            </template>

            <template v-else-if="column.key === 'actions'">
              <div class="flex gap-1">
                <a-button type="primary" size="small" :icon="h(CaretRightOutlined)" @click="openRun(record)">
                  Run
                </a-button>
                <a-button size="small" :icon="h(HistoryOutlined)" @click="openHistory(record)">
                  History
                </a-button>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </template>

    <!-- Visual builder placeholder -->
    <template v-else>
      <div class="flex flex-col items-center gap-4 rounded-2xl bg-white py-20 shadow-sm ring-1 ring-slate-200">
        <ClusterOutlined class="text-5xl text-slate-300" />
        <div class="text-lg font-semibold text-slate-600">Visual Builder</div>
        <div class="text-sm text-slate-400">Drag-and-drop workflow editor coming soon.</div>
      </div>
    </template>

    <!-- Create Workflow Modal -->
    <a-modal
      v-model:open="createOpen"
      title="Create Workflow"
      :confirm-loading="saving"
      ok-text="Create"
      width="640px"
      @ok="handleCreate"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item label="Name" required>
          <a-input v-model:value="form.name" placeholder="my-workflow" />
        </a-form-item>
        <a-form-item label="Description">
          <a-input v-model:value="form.description" placeholder="What does this workflow do?" />
        </a-form-item>

        <div class="mb-2 text-sm font-medium text-slate-700">Steps</div>
        <div class="mb-2 text-xs text-slate-500">
          Each step runs an agent. Use <span class="font-mono text-orange-600" v-text="'{{input}}'"></span> in prompts to pass the previous step's output.
        </div>

        <div
          v-for="(step, idx) in form.steps"
          :key="idx"
          class="mb-3 rounded-lg border border-slate-200 p-3"
        >
          <div class="mb-2 flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-400">#{{ idx + 1 }}</span>
            <a-input
              v-model:value="step.name"
              placeholder="Step name"
              size="small"
              class="flex-1"
            />
            <a-auto-complete
              v-model:value="step.agent_name"
              :options="agents.map((a) => ({ value: a.name || a.id }))"
              placeholder="Agent name"
              size="small"
              class="flex-1"
              :filter-option="(input, option) => option.value.toLowerCase().includes(input.toLowerCase())"
            />
            <a-select v-model:value="step.mode" :options="stepModes" size="small" style="width: 130px" />
            <a-button size="small" danger :icon="h(CloseOutlined)" @click="removeStep(idx)" />
          </div>
          <a-textarea v-model:value="step.prompt" :rows="2" placeholder="{{input}}" size="small" />
        </div>

        <a-button size="small" @click="addStep">+ Add Step</a-button>
      </a-form>
    </a-modal>

    <!-- Run Workflow Modal -->
    <a-modal
      v-model:open="runOpen"
      title="Run Workflow"
      ok-text="Run"
      @ok="handleRun"
      width="480px"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item label="Input">
          <a-textarea v-model:value="runInput" :rows="4" placeholder="Enter input for the first step..." />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- Run History Modal -->
    <a-modal
      v-model:open="historyOpen"
      :title="`Run History — ${historyWorkflow?.name || ''}`"
      :footer="null"
      width="800px"
    >
      <a-table
        :columns="runColumns"
        :data-source="runs"
        :loading="historyLoading"
        :pagination="{ pageSize: 10 }"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'state'">
            <a-tag :color="stateColor(record.state)">{{ stateText(record.state) }}</a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>
