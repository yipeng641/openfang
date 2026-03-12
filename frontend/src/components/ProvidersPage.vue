<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { apiGet, apiPost, apiPut } from '../api'

const loading = ref(false)
const saving = ref(false)
const drawerOpen = ref(false)
const search = ref('')
const providers = ref([])
const keyInputs = ref({})
const form = ref({
  name: '',
  base_url: '',
  api_key: '',
  protocol_type: 'openai',
})

const filteredProviders = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return providers.value
  return providers.value.filter((provider) => {
    return [provider.id, provider.display_name, provider.api_key_env, provider.base_url, provider.protocol_type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

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

async function addProvider() {
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
    message.success(`Provider ${name} added`)
    form.value = { name: '', base_url: '', api_key: '', protocol_type: 'openai' }
    drawerOpen.value = false
    await loadProviders()
  } catch (error) {
    message.error(`Failed to add provider: ${error.message}`)
  } finally {
    saving.value = false
  }
}

async function saveKey(provider) {
  const key = keyInputs.value[provider.id]
  if (!key || !key.trim()) {
    message.error('Please enter an API key')
    return
  }
  try {
    await apiPost(`/api/providers/${encodeURIComponent(provider.id)}/key`, { key: key.trim() })
    keyInputs.value[provider.id] = ''
    message.success(`Saved key for ${provider.display_name || provider.id}`)
    await loadProviders()
  } catch (error) {
    message.error(`Failed to save key: ${error.message}`)
  }
}

onMounted(loadProviders)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Providers</div>
          <div class="mt-1 text-sm text-slate-500">管理自定义 provider，只保留必要的连接配置。</div>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search providers..." class="w-full sm:w-80">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <div class="flex gap-2">
            <a-button :icon="h(ReloadOutlined)" @click="loadProviders">Refresh</a-button>
            <a-button type="primary" :icon="h(PlusOutlined)" @click="drawerOpen = true">Add Provider</a-button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      <a-card v-for="provider in filteredProviders" :key="provider.id" :loading="loading" class="rounded-2xl">
        <template #title>
          <div class="flex items-center justify-between gap-3">
            <span class="truncate">{{ provider.display_name || provider.id }}</span>
            <a-tag :color="statusColor(provider.auth_status)">{{ statusText(provider.auth_status) }}</a-tag>
          </div>
        </template>

        <div class="space-y-3 text-sm text-slate-600">
          <div><span class="font-medium text-slate-900">Provider ID:</span> {{ provider.id }}</div>
          <div><span class="font-medium text-slate-900">Protocol:</span> {{ provider.protocol_type || 'openai' }}</div>
          <div class="break-all"><span class="font-medium text-slate-900">Base URL:</span> {{ provider.base_url || '-' }}</div>
          <div><span class="font-medium text-slate-900">API Key Env:</span> {{ provider.api_key_env || '-' }}</div>
          <div><span class="font-medium text-slate-900">Models:</span> {{ provider.model_count || 0 }}</div>
        </div>

        <div class="mt-4 flex gap-2" v-if="provider.api_key_env && provider.auth_status !== 'configured'">
          <a-input-password v-model:value="keyInputs[provider.id]" :placeholder="`Enter ${provider.api_key_env}`" />
          <a-button type="primary" @click="saveKey(provider)">Save Key</a-button>
        </div>
      </a-card>
    </div>

    <a-empty v-if="!loading && filteredProviders.length === 0" description="No providers found" class="rounded-2xl bg-white py-12 shadow-sm ring-1 ring-slate-200" />

    <a-drawer v-model:open="drawerOpen" title="Add Provider" width="560" placement="right">
      <a-form layout="vertical">
        <a-form-item label="Name">
          <a-input v-model:value="form.name" placeholder="e.g. my-provider" />
        </a-form-item>
        <a-form-item label="Base URL">
          <a-input v-model:value="form.base_url" placeholder="https://api.example.com/v1" />
        </a-form-item>
        <a-form-item label="Protocol Type">
          <a-select v-model:value="form.protocol_type" :options="[{value:'openai'},{value:'anthropic'},{value:'gemini'}]" />
        </a-form-item>
        <a-form-item label="API Key">
          <a-input-password v-model:value="form.api_key" placeholder="Optional" />
        </a-form-item>
        <div class="flex justify-end gap-2">
          <a-button @click="drawerOpen = false">Cancel</a-button>
          <a-button type="primary" :loading="saving" @click="addProvider">Create</a-button>
        </div>
      </a-form>
    </a-drawer>
  </div>
</template>
