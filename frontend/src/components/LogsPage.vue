<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue, normalizeItems } from '../data-utils'

const loading = ref(false)
const search = ref('')
const logs = ref([])

const filteredLogs = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return logs.value
  return logs.value.filter((log) => JSON.stringify(log).toLowerCase().includes(query))
})

const columns = [
  { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', customRender: ({ value }) => formatValue(value) },
  { title: 'Level', dataIndex: 'level', key: 'level', customRender: ({ value }) => formatValue(value) },
  { title: 'Action', dataIndex: 'action', key: 'action', customRender: ({ value }) => formatValue(value) },
  { title: 'Actor', dataIndex: 'actor', key: 'actor', customRender: ({ value }) => formatValue(value) },
  { title: 'Detail', dataIndex: 'detail', key: 'detail', customRender: ({ value }) => formatValue(value) },
]

async function loadData() {
  loading.value = true
  try {
    const data = await apiGet('/api/audit/recent?n=200')
    logs.value = normalizeItems(data)
  } catch (error) {
    message.error(`Failed to load logs: ${error.message}`)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Logs</div>
          <div class="mt-1 text-sm text-slate-500">Audit stream and recent operational records.</div>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <a-input v-model:value="search" allow-clear placeholder="Search logs..." class="w-full sm:w-80">
            <template #prefix><SearchOutlined /></template>
          </a-input>
          <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <a-table :columns="columns" :data-source="filteredLogs" row-key="id" :pagination="{ pageSize: 12 }" :scroll="{ x: 960 }" />
    </div>
  </div>
</template>
