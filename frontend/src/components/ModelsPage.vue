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
import { apiDel, apiGet, apiPost } from '../api'

const loading = ref(false)
const saving = ref(false)
const modalOpen = ref(false)
const isEdit = ref(false)
const search = ref('')
const providerFilter = ref('')
const tierFilter = ref('')
const models = ref([])
const providers = ref([])
const testing = ref('')

const form = ref({
  id: '',
  provider: '',
  context_window: 128000,
  max_output_tokens: 8192,
})

const providerOptions = computed(() =>
  providers.value.map((p) => ({
    label: p.display_name || p.id,
    value: p.id,
  })),
)

const tierOptions = computed(() => {
  const values = [...new Set(models.value.map((m) => m.tier).filter(Boolean))]
  return values.map((v) => ({ label: v, value: v }))
})

const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return models.value.filter((model) => {
    if (providerFilter.value && model.provider !== providerFilter.value) return false
    if (tierFilter.value && model.tier !== tierFilter.value) return false
    if (!query) return true
    return [model.id, model.display_name, model.provider, model.tier]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(query))
  })
})

const columns = [
  {
    title: 'Model',
    key: 'display_name',
    ellipsis: true,
  },
  {
    title: 'Provider',
    dataIndex: 'provider',
    key: 'provider',
    width: 140,
  },
  {
    title: 'Tier',
    dataIndex: 'tier',
    key: 'tier',
    width: 100,
  },
  {
    title: 'Context',
    dataIndex: 'context_window',
    key: 'context_window',
    width: 100,
    align: 'right',
  },
  {
    title: 'Status',
    dataIndex: 'available',
    key: 'available',
    width: 120,
  },
  {
    title: 'Action',
    key: 'action',
    width: 220,
  },
]

function formatContext(value) {
  if (!value) return '-'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}

async function loadData() {
  loading.value = true
  try {
    const [modelsData, providersData] = await Promise.all([
      apiGet('/api/models'),
      apiGet('/api/providers'),
    ])
    models.value = modelsData.models || []
    providers.value = providersData.providers || []
  } catch (error) {
    message.error(`Failed to load models: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  isEdit.value = false
  form.value = { id: '', provider: '', context_window: 128000, max_output_tokens: 8192 }
  modalOpen.value = true
}

function openEdit(record) {
  isEdit.value = true
  form.value = {
    id: record.id,
    provider: record.provider || '',
    context_window: record.context_window || 128000,
    max_output_tokens: record.max_output_tokens || 8192,
  }
  modalOpen.value = true
}

async function handleSubmit() {
  if (!form.value.id.trim() || !form.value.provider.trim()) {
    message.error('Model ID and provider are required')
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      // Remove old, then re-add with updated fields
      await apiDel(`/api/models/custom/${encodeURIComponent(form.value.id.trim())}`)
    }
    await apiPost('/api/models/custom', {
      id: form.value.id.trim(),
      provider: form.value.provider.trim(),
      context_window: Number(form.value.context_window) || 128000,
      max_output_tokens: Number(form.value.max_output_tokens) || 8192,
    })
    message.success(isEdit.value ? `Model ${form.value.id.trim()} updated` : `Model ${form.value.id.trim()} added`)
    modalOpen.value = false
    await loadData()
  } catch (error) {
    message.error(`Failed to ${isEdit.value ? 'update' : 'add'} model: ${error.message}`)
  } finally {
    saving.value = false
  }
}

function removeModel(model) {
  Modal.confirm({
    title: 'Delete model',
    content: `Delete custom model "${model.id}"?`,
    okText: 'Delete',
    okType: 'danger',
    async onOk() {
      try {
        await apiDel(`/api/models/custom/${encodeURIComponent(model.id)}`)
        message.success(`Deleted ${model.id}`)
        await loadData()
      } catch (error) {
        message.error(`Failed to delete model: ${error.message}`)
      }
    },
  })
}

async function testModel(record) {
  testing.value = record.id
  try {
    const result = await apiPost(`/api/models/test/${encodeURIComponent(record.id)}`, {})
    if (result.status === 'ok') {
      message.success(`${record.display_name || record.id} — ok (${result.latency_ms}ms)`)
    } else {
      message.error(`${record.display_name || record.id} — ${result.error || 'test failed'}`)
    }
  } catch (error) {
    message.error(`Test failed: ${error.message}`)
  } finally {
    testing.value = ''
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-5">
    <!-- Header -->
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Models</div>
          <div class="mt-0.5 text-sm text-slate-500">查看当前模型目录，并管理用户手动添加的 custom models。</div>
        </div>
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search models..." class="w-full xl:w-72">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-select v-model:value="providerFilter" allow-clear placeholder="All Providers" class="w-full xl:w-44" :options="providerOptions" />
          <a-select v-model:value="tierFilter" allow-clear placeholder="All Tiers" class="w-full xl:w-36" :options="tierOptions" />
          <div class="flex gap-2">
            <a-button :icon="h(ReloadOutlined)" @click="loadData">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="openAdd">Add</a-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="mb-2 text-sm text-slate-500">{{ filteredModels.length }} of {{ models.length }} models</div>
      <a-table
        :columns="columns"
        :data-source="filteredModels"
        :loading="loading"
        :pagination="{ pageSize: 15 }"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'display_name'">
            <div class="font-medium text-slate-900">{{ record.display_name || record.id }}</div>
            <div class="text-xs text-slate-400">{{ record.id }}</div>
          </template>

          <template v-else-if="column.key === 'context_window'">
            {{ formatContext(text) }}
          </template>

          <template v-else-if="column.key === 'tier'">
            <a-tag>{{ text }}</a-tag>
          </template>

          <template v-else-if="column.key === 'available'">
            <a-tag :color="record.available ? 'success' : 'warning'">{{ record.available ? 'Available' : 'Needs Key' }}</a-tag>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="flex gap-1">
              <a-button
                type="link"
                size="small"
                :icon="h(ApiOutlined)"
                :loading="testing === record.id"
                @click="testModel(record)"
              >Test</a-button>
              <a-button
                v-if="record.tier === 'custom'"
                type="link"
                size="small"
                :icon="h(EditOutlined)"
                @click="openEdit(record)"
              >Edit</a-button>
              <a-button
                v-if="record.tier === 'custom'"
                type="link"
                size="small"
                danger
                :icon="h(DeleteOutlined)"
                @click="removeModel(record)"
              >Delete</a-button>
              <span v-if="record.tier !== 'custom' && testing !== record.id" />
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- Add / Edit Modal -->
    <a-modal
      v-model:open="modalOpen"
      :title="isEdit ? 'Edit Model' : 'Add Model'"
      :ok-text="isEdit ? 'Save' : 'Create'"
      :confirm-loading="saving"
      @ok="handleSubmit"
      width="520px"
    >
      <a-form layout="vertical" class="mt-4">
        <a-form-item label="Model ID" required>
          <a-input v-model:value="form.id" :disabled="isEdit" placeholder="e.g. my-org/my-model" />
        </a-form-item>
        <a-form-item label="Provider" required>
          <a-select
            v-model:value="form.provider"
            show-search
            placeholder="Select a provider"
            :options="providerOptions"
            :filter-option="(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())"
          />
        </a-form-item>
        <div class="grid grid-cols-2 gap-4">
          <a-form-item label="Context Window">
            <a-input-number v-model:value="form.context_window" class="!w-full" :min="1" />
          </a-form-item>
          <a-form-item label="Max Output Tokens">
            <a-input-number v-model:value="form.max_output_tokens" class="!w-full" :min="1" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>
