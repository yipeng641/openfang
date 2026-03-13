<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { apiGet } from '../api'
import { filterCommsEvents, formatCommsTime, normalizeCommsEvents, normalizeTopology } from '../comms-utils'

const activeTab = ref('topology')
const loadingTopology = ref(false)
const loadingEvents = ref(false)
const search = ref('')
const topologyPayload = ref({ nodes: [], edges: [] })
const eventsPayload = ref([])
const eventSourceRef = ref(null)

const topology = computed(() => normalizeTopology(topologyPayload.value))
const eventRows = computed(() => filterCommsEvents(normalizeCommsEvents(eventsPayload.value), search.value))

const summaryCards = computed(() => {
  const parentChildEdges = topology.value.edges.filter((edge) => String(edge.kind) === 'parent_child').length
  const peerEdges = topology.value.edges.filter((edge) => String(edge.kind) === 'peer').length

  return [
    { key: 'agents', label: 'Agents', value: topology.value.nodes.length },
    { key: 'parent', label: 'Parent Links', value: parentChildEdges },
    { key: 'peer', label: 'Peer Links', value: peerEdges },
    { key: 'events', label: 'Recent Events', value: eventRows.value.length },
  ]
})

const nodeColumns = [
  { title: 'Agent', dataIndex: 'name', key: 'name' },
  { title: 'State', dataIndex: 'state', key: 'state' },
  { title: 'Model', dataIndex: 'model', key: 'model', ellipsis: true },
  { title: 'Agent ID', dataIndex: 'id', key: 'id', ellipsis: true },
]

const edgeColumns = [
  { title: 'From', dataIndex: 'from', key: 'from', ellipsis: true },
  { title: 'To', dataIndex: 'to', key: 'to', ellipsis: true },
  { title: 'Kind', dataIndex: 'kind', key: 'kind' },
]

const eventColumns = [
  { title: 'Time', dataIndex: 'timestamp', key: 'timestamp', customRender: ({ value }) => formatCommsTime(value) },
  { title: 'Kind', dataIndex: 'kind', key: 'kind' },
  { title: 'Source', dataIndex: 'sourceName', key: 'sourceName' },
  { title: 'Target', dataIndex: 'targetName', key: 'targetName' },
  { title: 'Detail', dataIndex: 'detail', key: 'detail', ellipsis: true },
]

async function loadTopology() {
  loadingTopology.value = true
  try {
    topologyPayload.value = await apiGet('/api/comms/topology')
  } catch (error) {
    message.error(`Failed to load topology: ${error.message}`)
  } finally {
    loadingTopology.value = false
  }
}

async function loadEvents() {
  loadingEvents.value = true
  try {
    eventsPayload.value = await apiGet('/api/comms/events?limit=200')
  } catch (error) {
    message.error(`Failed to load events: ${error.message}`)
  } finally {
    loadingEvents.value = false
  }
}

function stopEventsStream() {
  if (eventSourceRef.value) {
    eventSourceRef.value.close()
    eventSourceRef.value = null
  }
}

function startEventsStream() {
  stopEventsStream()

  try {
    const source = new EventSource('/api/comms/events/stream')
    eventSourceRef.value = source

    source.onmessage = (event) => {
      if (!event.data || event.data === 'ping') return
      try {
        const payload = JSON.parse(event.data)
        eventsPayload.value = [payload, ...eventsPayload.value.filter((item) => item.id !== payload.id)].slice(0, 200)
      } catch {
      }
    }

    source.onerror = () => {
      stopEventsStream()
    }
  } catch {
  }
}

async function loadData() {
  await Promise.all([loadTopology(), loadEvents()])
}

onMounted(async () => {
  await loadData()
  startEventsStream()
})

onBeforeUnmount(() => {
  stopEventsStream()
})
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 xl:grid-cols-4">
      <div v-for="card in summaryCards" :key="card.key" class="rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
        <div class="text-3xl font-semibold text-slate-900">{{ card.value }}</div>
        <div class="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ card.label }}</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <a-tabs v-model:activeKey="activeTab" :animated="false" class="min-w-0 flex-1">
          <a-tab-pane key="topology" tab="Topology" />
          <a-tab-pane key="events" tab="Events" />
        </a-tabs>

        <div v-if="activeTab === 'events'" class="w-full xl:w-64">
          <a-input v-model:value="search" allow-clear placeholder="Search events..." />
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'topology'" class="space-y-4">
      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="mb-4 text-sm font-semibold text-slate-900">Agent Topology</div>
        <a-table
          :columns="nodeColumns"
          :data-source="topology.nodes"
          :loading="loadingTopology"
          :pagination="{ pageSize: 8, hideOnSinglePage: true }"
          row-key="key"
          size="small"
        />
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div class="mb-4 text-sm font-semibold text-slate-900">Relationship Edges</div>
        <a-table
          :columns="edgeColumns"
          :data-source="topology.edges"
          :loading="loadingTopology"
          :pagination="{ pageSize: 8, hideOnSinglePage: true }"
          row-key="key"
          size="small"
        />
      </div>
    </div>

    <div v-else class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div class="mb-4 text-sm font-semibold text-slate-900">Recent Communication Events</div>
      <a-table
        :columns="eventColumns"
        :data-source="eventRows"
        :loading="loadingEvents"
        :pagination="{ pageSize: 10, hideOnSinglePage: true }"
        row-key="key"
        size="small"
        :scroll="{ x: 960 }"
      />
    </div>
  </div>
</template>
