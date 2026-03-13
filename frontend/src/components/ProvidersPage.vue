<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { apiDel, apiGet, apiPost, apiPut } from '../api'

const loading = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const isEdit = ref(false)
const search = ref('')
const providers = ref([])
const testing = ref('')

const form = ref({
  name: '',
  base_url: '',
  api_key: '',
  protocol_type: 'openai',
})

const filteredProviders = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return providers.value
  return providers.value.filter((p) =>
    [p.id, p.display_name, p.base_url, p.protocol_type]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(query)),
  )
})

const columns = [
  {
    title: 'Provider',
    key: 'name',
    ellipsis: true,
  },
  {
    title: 'Protocol',
    dataIndex: 'protocol_type',
    key: 'protocol_type',
    width: 120,
  },
  {
    title: 'Base URL',
    dataIndex: 'base_url',
    key: 'base_url',
    ellipsis: true,
  },
  {
    title: 'Status',
    dataIndex: 'auth_status',
    key: 'auth_status',
    width: 130,
  },
  {
    title: 'Models',
    dataIndex: 'model_count',
    key: 'model_count',
    width: 80,
    align: 'center',
  },
  {
    title: 'Action',
    key: 'action',
    width: 240,
  },
]

function statusColor(status) {
  if (status === 'configured') return 'success'
  if (status === 'not_required') return 'processing'
  return 'warning'
}

function statusText(status) {
  if (status === 'configured') return 'Configured'
  if (status === 'not_required') return 'No Key Needed'
  return 'Not Set'
}

async function loadProviders() {
  loading.value = true
  try {
    const data = await apiGet('/api/providers')
    providers.value = data.providers || []
  } catch (error) {
    message.error(`Failed to load providers: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isEdit.value = false
  form.value = { name: '', base_url: '', api_key: '', protocol_type: 'openai' }
  modalOpen.value = true
}

function openEdit(record) {
  isEdit.value = true
  form.value = {
    name: record.id,
    base_url: record.base_url || '',
    api_key: '',
    protocol_type: record.protocol_type || 'openai',
  }
  modalOpen.value = true
}

async function handleSubmit() {
  const name = form.value.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  if (!name || !form.value.base_url.trim()) {
    message.error('Provider name and base URL are required')
    return
  }

  saving.value = true
  try {
    await apiPut(`/api/providers/${encodeURIComponent(name)}/url`, {
      base_url: form.value.base_url.trim(),
      protocol_type: form.value.protocol_type,
    })
    if (form.value.api_key.trim()) {
      await apiPost(`/api/providers/${encodeURIComponent(name)}/key`, {
        key: form.value.api_key.trim(),
      })
    }
    message.success(isEdit.value ? `Provider ${name} updated` : `Provider ${name} added`)
    modalOpen.value = false
    await loadProviders()
  } catch (error) {
    message.error(`Failed to ${isEdit.value ? 'update' : 'add'} provider: ${error.message}`)
  } finally {
    saving.value = false
  }
}

function confirmDelete(record) {
  Modal.confirm({
    title: 'Delete Provider',
    content: `Are you sure you want to delete "${record.display_name || record.id}"? This will remove its API key.`,
    okText: 'Delete',
    okType: 'danger',
    async onOk() {
      try {
        await apiDel(`/api/providers/${encodeURIComponent(record.id)}/key`)
        message.success(`Deleted ${record.display_name || record.id}`)
        await loadProviders()
      } catch (error) {
        message.error(`Failed to delete: ${error.message}`)
      }
    },
  })
}

async function testConnection(record) {
  testing.value = record.id
  try {
    const result = await apiPost(`/api/providers/${encodeURIComponent(record.id)}/test`, {})
    if (result.status === 'ok') {
      message.success(`${record.display_name || record.id} — connected (${result.latency_ms}ms)`)
    } else {
      message.error(`${record.display_name || record.id} — ${result.error || 'connection failed'}`)
    }
  } catch (error) {
    message.error(`Test failed: ${error.message}`)
  } finally {
    testing.value = ''
  }
}

onMounted(loadProviders)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Providers</div>
          <div class="mt-0.5 text-sm text-slate-500">管理 LLM Provider 连接配置与密钥。</div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search..." class="w-full sm:w-64">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div class="flex gap-2">
            <a-button :icon="h(ReloadOutlined)" @click="loadProviders">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="openAdd">Add</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="mb-2 text-sm text-slate-500">{{ filteredProviders.length }} of {{ providers.length }} providers</div>
      <a-table
        :columns="columns"
        :data-source="filteredProviders"
        :loading="loading"
        :pagination="{ pageSize: 15 }"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="font-medium text-slate-900">{{ record.display_name || record.id }}</div>
            <div class="text-xs text-slate-400">{{ record.id }}</div>
          </template>

          <template v-else-if="column.key === 'auth_status'">
            <a-tag :color="statusColor(record.auth_status)">{{ statusText(record.auth_status) }}</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="flex gap-1">
              <a-button
                type="link"
                size="small"
                :icon="h(ApiOutlined)"
                :loading="testing === record.id"
                @click="testConnection(record)"
              >Test</a-button>
              <a-button type="link" size="small" :icon="h(EditOutlined)" @click="openEdit(record)">Edit</a-button>
              <a-button type="link" size="small" danger :icon="h(DeleteOutlined)" @click="confirmDelete(record)">Delete</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- Add / Edit Modal -->
    <a-modal
      v-model:open="modalOpen"
      :title="isEdit ? 'Edit Provider' : 'Add Provider'"
      :ok-text="isEdit ? 'Save' : 'Create'"
      :confirm-loading="saving"
      @ok="handleSubmit"
      width="520px"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item label="Name" required>
          <a-input
            v-model:value="form.name"
            :disabled="isEdit"
            placeholder="e.g. my-provider"
          />
        </a-form-item>
        <a-form-item label="Base URL" required>
          <a-input v-model:value="form.base_url" placeholder="https://api.example.com/v1" />
        </a-form-item>
        <a-form-item label="Protocol">
          <a-select
            v-model:value="form.protocol_type"
            :options="[{ value: 'openai', label: 'OpenAI' }, { value: 'anthropic', label: 'Anthropic' }, { value: 'gemini', label: 'Gemini' }]"
          />
        </a-form-item>
        <a-form-item :label="isEdit ? 'API Key (leave blank to keep current)' : 'API Key (optional)'">
          <a-input-password v-model:value="form.api_key" placeholder="sk-..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
