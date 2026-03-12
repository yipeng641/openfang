<script setup>
import { computed, h, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../api'
import { formatValue, normalizeItems } from '../data-utils'

const loading = ref(false)
const acting = ref('')
const approvals = ref([])

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: 'Kind', dataIndex: 'kind', key: 'kind' },
  { title: 'Agent', dataIndex: 'agent_id', key: 'agent_id' },
  { title: 'Created', dataIndex: 'created_at', key: 'created_at', customRender: ({ value }) => formatValue(value) },
  { title: 'Reason', dataIndex: 'reason', key: 'reason', customRender: ({ value }) => formatValue(value) },
  { title: 'Action', key: 'action' },
]

async function loadData() {
  loading.value = true
  try {
    const data = await apiGet('/api/approvals')
    approvals.value = normalizeItems(data)
  } catch (error) {
    message.error(`Failed to load approvals: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function takeAction(record, action) {
  acting.value = `${action}:${record.id}`
  try {
    await apiPost(`/api/approvals/${encodeURIComponent(record.id)}/${action}`, {})
    message.success(`${action === 'approve' ? 'Approved' : 'Rejected'} ${record.id}`)
    await loadData()
  } catch (error) {
    message.error(`Action failed: ${error.message}`)
  } finally {
    acting.value = ''
  }
}

const pendingCount = computed(() => approvals.value.length)

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Approvals</div>
          <div class="mt-1 text-sm text-slate-500">Pending manual approvals from the old approvals page flow.</div>
        </div>
        <div class="flex items-center gap-2">
          <a-tag color="gold">{{ pendingCount }} Pending</a-tag>
          <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <a-table :columns="columns" :data-source="approvals" row-key="id" :pagination="{ pageSize: 10 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <div class="flex gap-2">
              <a-button size="small" type="primary" :loading="acting === `approve:${record.id}`" @click="takeAction(record, 'approve')">Approve</a-button>
              <a-button size="small" danger :loading="acting === `reject:${record.id}`" @click="takeAction(record, 'reject')">Reject</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>
