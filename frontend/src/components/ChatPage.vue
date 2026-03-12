<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SendOutlined } from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../api'
import { normalizeItems } from '../data-utils'

const loading = ref(false)
const sending = ref(false)
const agents = ref([])
const status = ref(null)
const selectedAgentId = ref('')
const input = ref('')
const messages = ref([])
const messageListRef = ref(null)
let refreshTimer = null

marked.setOptions({
  breaks: true,
  gfm: true,
})

const selectedAgent = computed(() => agents.value.find((agent) => String(agent.id) === String(selectedAgentId.value)) || null)
const normalizedMessages = computed(() => {
  return messages.value.map((entry, index) => {
    const content =
      entry?.content ??
      entry?.text ??
      entry?.message ??
      entry?.response ??
      (Array.isArray(entry?.parts) ? entry.parts.map((part) => part?.text || String(part)).join('\n') : '')

    return {
      id: entry?.id || entry?.message_id || `${entry?.role || 'message'}-${index}`,
      role: String(entry?.role || 'assistant').toLowerCase(),
      content: typeof content === 'string' ? content : JSON.stringify(content || '', null, 2),
      createdAt: entry?.created_at || entry?.timestamp || '',
      html: renderMessageContent(typeof content === 'string' ? content : JSON.stringify(content || '', null, 2)),
    }
  })
})

function renderMessageContent(content) {
  const rendered = marked.parse(content || '')
  return DOMPurify.sanitize(rendered)
}

function scrollMessagesToBottom(behavior = 'smooth') {
  const element = messageListRef.value
  if (!element) return
  element.scrollTo({ top: element.scrollHeight, behavior })
}

function scheduleMessageScroll(behavior = 'smooth') {
  nextTick(() => scrollMessagesToBottom(behavior))
}

async function loadAgents() {
  const data = await apiGet('/api/agents')
  agents.value = normalizeItems(data)
  if (!selectedAgentId.value && agents.value.length) {
    selectedAgentId.value = agents.value[0].id
  }
}

async function loadCurrentSession() {
  if (!selectedAgentId.value) {
    messages.value = []
    return
  }
  try {
    const data = await apiGet(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/session`)
    const history = data?.messages || data?.items || []
    messages.value = Array.isArray(history) ? history : []
    scheduleMessageScroll('auto')
  } catch {
    messages.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const [statusData] = await Promise.all([
      apiGet('/api/status').catch(() => null),
      loadAgents(),
    ])
    status.value = statusData
    await loadCurrentSession()
  } catch (error) {
    message.error(`Failed to load chat page: ${error.message}`)
  } finally {
    loading.value = false
  }
}

async function sendMessage() {
  const text = input.value.trim()
  if (!selectedAgentId.value || !text) return

  sending.value = true
  input.value = ''
  messages.value = [...messages.value, { role: 'user', content: text, text }]
  scheduleMessageScroll()
  try {
    const data = await apiPost(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/message`, { message: text })
    messages.value = [
      ...messages.value,
      { role: 'assistant', content: data.response || '(no response)', text: data.response || '(no response)' },
    ]
    scheduleMessageScroll()
  } catch (error) {
    message.error(`Send failed: ${error.message}`)
  } finally {
    sending.value = false
  }
}

function startAutoRefresh() {
  stopAutoRefresh()
  refreshTimer = window.setInterval(() => {
    if (!selectedAgentId.value || sending.value) return
    loadCurrentSession()
  }, 4000)
}

function stopAutoRefresh() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer)
    refreshTimer = null
  }
}

watch(selectedAgentId, async () => {
  await loadCurrentSession()
  scheduleMessageScroll('auto')
})

watch(() => normalizedMessages.value.length, () => {
  scheduleMessageScroll()
})

onMounted(async () => {
  await loadData()
  startAutoRefresh()
})

onBeforeUnmount(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-5 overflow-hidden">
    <div class="shrink-0 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">Chat</div>
          <div class="mt-1 text-sm text-slate-500">Agent list, current session, and a lightweight send box.</div>
        </div>
        <div class="flex items-center gap-3">
          <a-tag color="blue">{{ agents.length }} Agents</a-tag>
          <a-tag color="green">{{ status?.runtime_status || status?.status || 'Online' }}</a-tag>
          <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
        </div>
      </div>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)]">
      <div class="min-h-0 overflow-hidden">
        <div class="flex h-full min-h-0 flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 text-base font-semibold text-slate-900">Agents</div>
          <a-list :data-source="agents" bordered class="flex-1 overflow-y-auto rounded-xl">
            <template #renderItem="{ item }">
              <a-list-item class="cursor-pointer" @click="selectedAgentId = item.id">
                <div class="w-full">
                  <div class="font-medium" :class="selectedAgentId === item.id ? 'text-blue-600' : 'text-slate-900'">
                    {{ item.name || item.display_name || item.id }}
                  </div>
                  <div class="mt-1 text-xs text-slate-500">{{ item.model || item.provider || item.mode || 'Agent' }}</div>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>

      <div class="min-h-0 overflow-hidden">
        <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 shrink-0 flex items-center justify-between gap-3">
            <div>
              <div class="text-base font-semibold text-slate-900">{{ selectedAgent?.name || selectedAgent?.id || 'Conversation' }}</div>
              <div class="mt-1 text-sm text-slate-500">{{ selectedAgent?.description || 'Select an agent to inspect and send a message.' }}</div>
            </div>
            <a-tag color="blue">{{ normalizedMessages.length }} Messages</a-tag>
          </div>

          <div
            ref="messageListRef"
            class="mb-4 min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4"
          >
            <div class="flex min-h-full flex-col gap-3">
              <div v-if="!normalizedMessages.length" class="my-auto text-center text-sm text-slate-500">No messages yet.</div>
              <div
                v-for="entry in normalizedMessages"
                :key="entry.id"
                class="flex"
                :class="entry.role === 'user' ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm"
                  :class="entry.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-800 ring-1 ring-slate-200'"
                >
                  <div class="mb-1 flex items-center gap-2 text-[11px] uppercase opacity-70">
                    <span>{{ entry.role }}</span>
                    <span v-if="entry.createdAt">- {{ entry.createdAt }}</span>
                  </div>
                  <div
                    class="chat-markdown break-words leading-6"
                    :class="entry.role === 'user' ? 'chat-markdown-user' : 'chat-markdown-assistant'"
                    v-html="entry.html"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="shrink-0 flex gap-3 border-t border-slate-200 pt-4">
            <a-textarea
              v-model:value="input"
              :auto-size="{ minRows: 2, maxRows: 5 }"
              placeholder="Send a message to the selected agent..."
              @pressEnter.exact.prevent="sendMessage"
            />
            <a-button type="primary" :icon="h(SendOutlined)" :loading="sending" @click="sendMessage">Send</a-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
