<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { apiGet } from '../api'
import { exportLogLines, filterLogEntries, formatLogTime, normalizeLogEntries } from '../logs-utils'

const activeTab = ref('live')
const loading = ref(false)
const auditLoading = ref(false)
const query = ref('')
const level = ref('')
const auditAction = ref('')
const liveEntries = ref([])
const auditEntries = ref([])
const streamConnected = ref(false)
const streamPaused = ref(false)
const autoScroll = ref(true)
const currentPage = ref(1)
const auditPage = ref(1)
const pageSize = 20
const eventSourceRef = ref(null)
const pollTimerRef = ref(null)
const liveContainerRef = ref(null)

const filteredLiveEntries = computed(() => {
  return filterLogEntries(liveEntries.value, {
    level: level.value,
    query: query.value,
  })
})

const pagedLiveEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredLiveEntries.value.slice(start, start + pageSize)
})

const filteredAuditEntries = computed(() => {
  return filterLogEntries(auditEntries.value, {
    query: query.value,
    action: auditAction.value,
  })
})

const pagedAuditEntries = computed(() => {
  const start = (auditPage.value - 1) * pageSize
  return filteredAuditEntries.value.slice(start, start + pageSize)
})

const auditActionOptions = computed(() => {
  return [...new Set(auditEntries.value.map((entry) => entry.action))]
    .sort((left, right) => left.localeCompare(right))
    .map((actionName) => ({ label: actionName, value: actionName }))
})

const connectionLabel = computed(() => {
  if (streamPaused.value) return 'PAUSED'
  return streamConnected.value ? 'LIVE' : 'POLLING'
})

const connectionClass = computed(() => {
  return streamConnected.value && !streamPaused.value
    ? 'bg-emerald-500'
    : 'bg-amber-500'
})

function mergeEntries(targetRef, incomingEntries) {
  const byKey = new Map(targetRef.value.map((entry) => [entry.key, entry]))
  for (const entry of incomingEntries) {
    byKey.set(entry.key, entry)
  }
  targetRef.value = [...byKey.values()]
    .sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || '')) || Number(right.seq || 0) - Number(left.seq || 0))
    .slice(0, 500)
}

function scrollLiveToTop() {
  if (!liveContainerRef.value || !autoScroll.value) return
  liveContainerRef.value.scrollTop = 0
}

async function loadAudit() {
  auditLoading.value = true
  try {
    const data = await apiGet('/api/audit/recent?n=200')
    auditEntries.value = normalizeLogEntries(data)
  } catch (error) {
    message.error(`Failed to load audit trail: ${error.message}`)
  } finally {
    auditLoading.value = false
  }
}

async function fetchLiveSnapshot() {
  loading.value = true
  try {
    const data = await apiGet('/api/audit/recent?n=200')
    liveEntries.value = normalizeLogEntries(data)
    await nextTick()
    scrollLiveToTop()
  } catch (error) {
    message.error(`Failed to load live logs: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function stopPolling() {
  if (pollTimerRef.value) {
    clearInterval(pollTimerRef.value)
    pollTimerRef.value = null
  }
}

function startPolling() {
  stopPolling()
  streamConnected.value = false
  pollTimerRef.value = window.setInterval(() => {
    if (activeTab.value === 'live' && !streamPaused.value) {
      fetchLiveSnapshot()
    }
  }, 3000)
}

function stopStreaming() {
  if (eventSourceRef.value) {
    eventSourceRef.value.close()
    eventSourceRef.value = null
  }
  streamConnected.value = false
}

function startStreaming() {
  stopStreaming()
  stopPolling()

  try {
    const source = new EventSource('/api/logs/stream')
    eventSourceRef.value = source

    source.onopen = () => {
      streamConnected.value = true
      loading.value = false
    }

    source.onmessage = async (event) => {
      if (streamPaused.value) return
      try {
        const payload = JSON.parse(event.data)
        mergeEntries(liveEntries, normalizeLogEntries({ entries: [payload] }))
        await nextTick()
        scrollLiveToTop()
      } catch {
      }
    }

    source.onerror = () => {
      stopStreaming()
      startPolling()
    }
  } catch {
    startPolling()
  }
}

function refreshCurrentTab() {
  if (activeTab.value === 'live') {
    fetchLiveSnapshot()
  } else {
    loadAudit()
  }
}

function togglePause() {
  if (activeTab.value !== 'live') return
  streamPaused.value = !streamPaused.value
}

function clearLiveEntries() {
  liveEntries.value = []
}

function clearAuditEntries() {
  auditEntries.value = []
}

function exportCurrentLogs() {
  const source = activeTab.value === 'live' ? filteredLiveEntries.value : filteredAuditEntries.value
  const blob = new Blob([exportLogLines(source)], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `openfang-${activeTab.value}-logs.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}

watch([query, level], () => {
  currentPage.value = 1
})

watch([query, auditAction], () => {
  auditPage.value = 1
})

watch(activeTab, (tab) => {
  if (tab === 'audit' && !auditEntries.value.length) {
    loadAudit()
  }
})

onMounted(async () => {
  await fetchLiveSnapshot()
  startStreaming()
})

onBeforeUnmount(() => {
  stopStreaming()
  stopPolling()
})
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <a-tabs v-model:activeKey="activeTab" :animated="false" class="logs-tabs min-w-0 flex-1">
          <a-tab-pane key="live" tab="Live" />
          <a-tab-pane key="audit" tab="Audit Trail" />
        </a-tabs>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <span :class="['h-2 w-2 rounded-full', connectionClass]" />
            {{ connectionLabel }}
          </div>

          <a-select
            v-if="activeTab === 'live'"
            v-model:value="level"
            :options="[
              { label: 'All', value: '' },
              { label: 'Info', value: 'info' },
              { label: 'Warn', value: 'warn' },
              { label: 'Error', value: 'error' },
            ]"
            class="w-28"
            size="small"
          />

          <a-select
            v-else
            v-model:value="auditAction"
            :options="[{ label: 'All', value: '' }, ...auditActionOptions]"
            class="w-40"
            size="small"
            show-search
            option-filter-prop="label"
          />

          <a-input v-model:value="query" allow-clear placeholder="Search..." class="w-52" size="small" />
          <a-button size="small" @click="togglePause">{{ streamPaused ? 'Resume' : 'Pause' }}</a-button>
          <a-button size="small" @click="activeTab === 'live' ? clearLiveEntries() : clearAuditEntries()">Clear</a-button>
          <a-button size="small" @click="refreshCurrentTab">Refresh</a-button>
          <a-button size="small" @click="exportCurrentLogs">Export</a-button>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span>Auto-scroll</span>
            <a-switch v-model:checked="autoScroll" size="small" />
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <div ref="liveContainerRef" class="max-h-[640px] overflow-auto rounded-xl border border-slate-100 bg-white">
        <div v-if="activeTab === 'live'">
          <div
            v-for="entry in pagedLiveEntries"
            :key="entry.key"
            class="grid grid-cols-[92px_72px_minmax(150px,220px)_120px_minmax(240px,1fr)] items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs text-slate-700"
          >
            <span class="text-slate-400">{{ formatLogTime(entry.timestamp) }}</span>
            <span
              class="font-semibold uppercase"
              :class="{
                'text-sky-500': entry.level === 'info',
                'text-amber-500': entry.level === 'warn',
                'text-rose-500': entry.level === 'error',
              }"
            >
              {{ entry.level }}
            </span>
            <span class="truncate text-slate-500">{{ entry.agentId }}</span>
            <span class="truncate font-medium text-slate-900">{{ entry.action }}</span>
            <span class="truncate text-slate-600">{{ entry.detail || '-' }}</span>
          </div>
          <a-empty v-if="!pagedLiveEntries.length && !loading" description="No live logs" class="py-12" />
        </div>

        <div v-else>
          <div
            v-for="entry in pagedAuditEntries"
            :key="entry.key"
            class="grid grid-cols-[92px_200px_140px_minmax(280px,1fr)] items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs text-slate-700"
          >
            <span class="text-slate-400">{{ formatLogTime(entry.timestamp) }}</span>
            <span class="truncate font-medium text-slate-900">{{ entry.action }}</span>
            <span class="truncate text-slate-500">{{ entry.agentId }}</span>
            <span class="truncate text-slate-600">{{ entry.detail || '-' }}</span>
          </div>
          <a-empty v-if="!pagedAuditEntries.length && !auditLoading" description="No audit entries" class="py-12" />
        </div>
      </div>

      <div class="mt-4 flex justify-end">
        <a-pagination
          v-if="activeTab === 'live'"
          v-model:current="currentPage"
          :page-size="pageSize"
          :total="filteredLiveEntries.length"
          size="small"
          show-less-items
        />
        <a-pagination
          v-else
          v-model:current="auditPage"
          :page-size="pageSize"
          :total="filteredAuditEntries.length"
          size="small"
          show-less-items
        />
      </div>
    </div>
  </div>
</template>
