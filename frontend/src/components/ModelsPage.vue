<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { apiDel, apiGet, apiPost } from '../api'

const loading = ref(false)
const saving = ref(false)
const drawerOpen = ref(false)
const search = ref('')
const providerFilter = ref('')
const tierFilter = ref('')
const models = ref([])
const providers = ref([])
const form = ref({
  id: '',
  provider: '',
  context_window: 128000,
  max_output_tokens: 8192,
})

const providerOptions = computed(() => providers.value.map((provider) => ({
  label: provider.display_name || provider.id,
  value: provider.id,
})))

const tierOptions = computed(() => {
  const values = [...new Set(models.value.map((model) => model.tier).filter(Boolean))]
  return values.map((value) => ({ label: value, value }))
})

const filteredModels = computed(() => {
  const query = search.value.trim().toLowerCase()
  return models.value.filter((model) => {
    if (providerFilter.value && model.provider !== providerFilter.value) return false
    if (tierFilter.value && model.tier !== tierFilter.value) return false
    if (!query) return true
    return [model.id, model.display_name, model.provider, model.tier]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

const columns = [
  {
    title: 'Model',
    dataIndex: 'display_name',
    key: 'display_name',
    customRender: ({ record }) => record.display_name || record.id,
  },
  {
    title: 'Provider',
    dataIndex: 'provider',
    key: 'provider',
  },
  {
    title: 'Tier',
    dataIndex: 'tier',
    key: 'tier',
  },
  {
    title: 'Context',
    dataIndex: 'context_window',
    key: 'context_window',
    customRender: ({ value }) => formatContext(value),
  },
  {
    title: 'Status',
    dataIndex: 'available',
    key: 'available',
  },
  {
    title: 'Action',
    key: 'action',
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

async function addModel() {
  if (!form.value.id.trim() || !form.value.provider.trim()) {
    message.error('Model ID and provider are required')
    return
  }

  saving.value = true
  try {
    await apiPost('/api/models/custom', {
      id: form.value.id.trim(),
      provider: form.value.provider.trim(),
      context_window: Number(form.value.context_window) || 128000,
      max_output_tokens: Number(form.value.max_output_tokens) || 8192,
    })
    message.success(`Model ${form.value.id.trim()} added`)
    form.value = { id: '', provider: '', context_window: 128000, max_output_tokens: 8192 }
    drawerOpen.value = false
    await loadData()
  } catch (error) {
    message.error(`Failed to add model: ${error.message}`)
  } finally {
    saving.value = false
  }
}

function removeModel(model) {
  Modal.confirm({
    title: 'Delete model',
    content: `Delete custom model ${model.id}?`,
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

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Models</div>
          <div class="mt-1 text-sm text-slate-500">查看当前模型目录，并管理用户手动添加的 custom models。</div>
        </div>
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search models..." class="w-full xl:w-80">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-select v-model:value="providerFilter" allow-clear placeholder="All Providers" class="w-full xl:w-44" :options="providerOptions" />
          <a-select v-model:value="tierFilter" allow-clear placeholder="All Tiers" class="w-full xl:w-40" :options="tierOptions" />
          <div class="flex gap-2">
            <a-button :icon="h(ReloadOutlined)" @click="loadData">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="drawerOpen = true">Add Model</a-button>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="mb-3 text-sm text-slate-500">{{ filteredModels.length }} of {{ models.length }} models</div>
      <a-table :columns="columns" :data-source="filteredModels" :loading="loading" :pagination="{ pageSize: 10 }" row-key="id">
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'available'">
            <a-tag :color="record.available ? 'success' : 'warning'">{{ record.available ? 'Available' : 'Needs Key' }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="record.tier === 'custom'" danger type="link" :icon="h(DeleteOutlined)" @click="removeModel(record)">Delete</a-button>
            <span v-else class="text-slate-300">—</span>
          </template>
          <template v-else-if="column.key === 'tier'">
            <a-tag>{{ text }}</a-tag>
          </template>
        </template>
      </a-table>
    </div>

    <a-drawer v-model:open="drawerOpen" title="Add Model" width="560" placement="right">
      <a-form layout="vertical">
        <a-form-item label="Model ID">
          <a-input v-model:value="form.id" placeholder="e.g. my-org/my-model" />
        </a-form-item>
        <a-form-item label="Provider">
          <a-input v-model:value="form.provider" placeholder="e.g. my-provider" />
        </a-form-item>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <a-form-item label="Context Window">
            <a-input-number v-model:value="form.context_window" class="!w-full" :min="1" />
          </a-form-item>
          <a-form-item label="Max Output Tokens">
            <a-input-number v-model:value="form.max_output_tokens" class="!w-full" :min="1" />
          </a-form-item>
        </div>
        <div class="flex justify-end gap-2">
          <a-button @click="drawerOpen = false">Cancel</a-button>
          <a-button type="primary" :loading="saving" @click="addModel">Create</a-button>
        </div>
      </a-form>
    </a-drawer>
  </div>
</template>
