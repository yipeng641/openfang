<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { message } from 'ant-design-vue'
import { CloseOutlined, PaperClipOutlined, PlusOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons-vue'
import { apiGet, apiPost, apiPut, openAgentSocket } from '../api'
import { normalizeItems } from '../data-utils'

const loading = ref(false)
const sending = ref(false)
const uploading = ref(false)
const switchingModel = ref(false)
const switchingSession = ref(false)
const agents = ref([])
const status = ref(null)
const availableModels = ref([])
const slashCommands = ref([])
const selectedAgentId = ref('')
const selectedSessionId = ref('')
const input = ref('')
const serverMessages = ref([])
const localMessages = ref([])
const agentSessions = ref([])
const pendingAttachments = ref([])
const messageListRef = ref(null)
const fileInputRef = ref(null)
const shouldAutoScroll = ref(true)
const hasUnreadMessages = ref(false)
const wsConnected = ref(false)
const showToolMessages = ref(readToolVisibilityPreference())
let localMessageSequence = 0
let messageSequence = 0
let agentSocket = null
let socketAgentId = ''
let streamingMessageId = ''
let syncingSessionSelection = false
const AUTO_SCROLL_THRESHOLD = 80

const fallbackSlashCommands = [
  { cmd: '/help', desc: 'Show available commands' },
  { cmd: '/new', desc: 'Start a new session' },
  { cmd: '/compact', desc: 'Trigger LLM session compaction' },
  { cmd: '/model', desc: 'Show or switch model (/model [name])' },
  { cmd: '/status', desc: 'Show system status' },
  { cmd: '/clear', desc: 'Clear local helper messages' },
]

marked.setOptions({
  breaks: true,
  gfm: true,
})

const selectedAgent = computed(() => agents.value.find((agent) => String(agent.id) === String(selectedAgentId.value)) || null)
const selectedSession = computed(() => {
  return agentSessions.value.find((session) => String(session.session_id) === String(selectedSessionId.value)) || null
})
const sessionOptions = computed(() => {
  return agentSessions.value.map((session, index) => ({
    value: session.session_id,
    label: formatSessionLabel(session, index),
    searchText: `${session.label || ''} ${session.session_id || ''}`.toLowerCase(),
  }))
})
const mergedMessages = computed(() => {
  return [...serverMessages.value, ...localMessages.value]
    .slice()
    .sort((left, right) => {
      const leftSeq = Number(left?._seq || 0)
      const rightSeq = Number(right?._seq || 0)
      if (leftSeq !== rightSeq) return leftSeq - rightSeq
      return 0
    })
})
const normalizedMessages = computed(() => {
  return mergedMessages.value
    .flatMap((entry, index) => buildVisibleMessages(entry, index))
    .filter((entry) => showToolMessages.value || entry.messageKind !== 'tool')
})
const currentModelOptionId = computed(() => {
  if (!selectedAgent.value) return undefined
  const provider = selectedAgent.value.model_provider || selectedAgent.value.provider || ''
  const modelName = selectedAgent.value.model_name || selectedAgent.value.model || ''
  const directMatch = availableModels.value.find((item) => item.id === modelName)
  if (directMatch) return directMatch.id
  const providerMatch = availableModels.value.find((item) => {
    return item.provider === provider && (item.id === modelName || item.id.endsWith(`/${modelName}`))
  })
  return providerMatch?.id
})
const currentModelLabel = computed(() => {
  if (!selectedAgent.value) return 'No model selected'
  const provider = selectedAgent.value.model_provider || selectedAgent.value.provider
  const modelName = selectedAgent.value.model_name || selectedAgent.value.model
  if (provider && modelName) return `${provider} / ${modelName}`
  return modelName || provider || 'No model selected'
})
const modelOptions = computed(() => {
  return availableModels.value.map((item) => ({
    value: item.id,
    label: `${item.display_name || item.id} - ${item.provider}`,
    searchText: `${item.display_name || item.id} ${item.id} ${item.provider}`.toLowerCase(),
  }))
})
const selectedAgentSubtitle = computed(() => {
  const profile = selectedAgent.value?.profile
  if (typeof profile === 'string' && profile.trim()) return profile
  if (profile && typeof profile === 'object') {
    return profile.description || profile.bio || profile.summary || ''
  }
  return ''
})
const slashQuery = computed(() => {
  const draft = input.value.trimStart()
  if (!draft.startsWith('/')) return ''
  return draft.slice(1).split(/\s+/)[0].toLowerCase()
})
const filteredSlashCommands = computed(() => {
  const query = slashQuery.value
  if (!input.value.trimStart().startsWith('/')) return []
  return slashCommands.value.filter((item) => {
    const haystack = `${item.cmd} ${item.desc || ''}`.toLowerCase()
    return !query || haystack.includes(query)
  })
})
const showSlashMenu = computed(() => Boolean(selectedAgentId.value) && filteredSlashCommands.value.length > 0)
const headerStatusLabel = computed(() => {
  const runtimeStatus = String(status.value?.runtime_status || status.value?.status || 'online').toLowerCase()
  return `${agents.value.length} agents ${runtimeStatus}`
})
const selectedSessionSummary = computed(() => {
  if (!selectedSession.value) return 'Current session'
  const count = Number(selectedSession.value.message_count || 0)
  const label = selectedSession.value.label || truncateMiddle(String(selectedSession.value.session_id || ''), 8, 4)
  return `${label} | ${count} message${count === 1 ? '' : 's'}`
})

function renderMessageContent(content) {
  const rendered = marked.parse(content || '')
  return DOMPurify.sanitize(rendered)
}

function readToolVisibilityPreference() {
  try {
    const value = window.localStorage.getItem('openfang-chat-show-tools')
    if (value == null) return true
    return value !== 'false'
  } catch {
    return true
  }
}

function persistToolVisibilityPreference(value) {
  try {
    window.localStorage.setItem('openfang-chat-show-tools', value ? 'true' : 'false')
  } catch {
    // Ignore persistence failures in private mode / locked storage
  }
}

function truncateMiddle(value, head = 8, tail = 4) {
  const text = String(value || '')
  if (text.length <= head + tail + 3) return text
  return `${text.slice(0, head)}...${text.slice(-tail)}`
}

function formatSessionLabel(session, index = 0) {
  const label = session?.label || truncateMiddle(String(session?.session_id || ''), 8, 4) || `session-${index + 1}`
  const createdAt = session?.created_at ? formatSessionCreatedAt(session.created_at) : ''
  const count = Number(session?.message_count || 0)
  const countLabel = `${count} message${count === 1 ? '' : 's'}`
  return [label, createdAt, countLabel].filter(Boolean).join(' | ')
}

function formatSessionCreatedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function isNearBottom() {
  const element = messageListRef.value
  if (!element) return true
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  return distanceFromBottom <= AUTO_SCROLL_THRESHOLD
}

function scrollMessagesToBottom(behavior = 'smooth') {
  const element = messageListRef.value
  if (!element) return
  element.scrollTo({ top: element.scrollHeight, behavior })
  shouldAutoScroll.value = true
  hasUnreadMessages.value = false
}

function scheduleMessageScroll(behavior = 'smooth', { force = false } = {}) {
  nextTick(() => {
    if (force || shouldAutoScroll.value) {
      scrollMessagesToBottom(behavior)
      return
    }
    hasUnreadMessages.value = true
  })
}

function handleMessageListScroll() {
  const nearBottom = isNearBottom()
  shouldAutoScroll.value = nearBottom
  if (nearBottom) {
    hasUnreadMessages.value = false
  }
}

function nextMessageSequence() {
  messageSequence += 1
  return messageSequence
}

function getMessageContent(entry) {
  return (
    entry?.content ??
    entry?.text ??
    entry?.message ??
    entry?.response ??
    (Array.isArray(entry?.parts) ? entry.parts.map((part) => part?.text || String(part)).join('\n') : '')
  )
}

function sameMessageEntry(left, right) {
  if (!left || !right) return false
  if (String(left?.role || '') !== String(right?.role || '')) return false
  return String(getMessageContent(left) || '') === String(getMessageContent(right) || '')
}

function formatCodeBlock(value, language = '') {
  const body = typeof value === 'string' ? value : JSON.stringify(value || '', null, 2)
  return `\`\`\`${language}\n${body}\n\`\`\``
}

function formatStageMessage(title, details) {
  if (!details) return `### ${title}`
  return `### ${title}\n\n${details}`
}

function normalizeMessageShape(entry, fallbackId, fallbackContent, extra = {}) {
  const content = typeof fallbackContent === 'string'
    ? fallbackContent
    : JSON.stringify(fallbackContent || '', null, 2)

  return {
    id: extra.id || entry?.id || entry?.message_id || fallbackId,
    role: String(extra.role || entry?.role || 'assistant').toLowerCase(),
    label: extra.label || entry?.label || String(extra.role || entry?.role || 'assistant').toLowerCase(),
    messageKind: extra.messageKind || entry?.messageKind || 'message',
    content,
    createdAt: extra.createdAt || entry?.created_at || entry?.timestamp || '',
    html: renderMessageContent(content),
  }
}

function buildVisibleMessages(entry, index) {
  const baseId = entry?.id || entry?.message_id || `${entry?.role || 'message'}-${index}`
  const rawContent = getMessageContent(entry)
  const images = Array.isArray(entry?.images) ? entry.images : []
  const tools = Array.isArray(entry?.tools) ? entry.tools : []
  const visible = []

  let baseContent = typeof rawContent === 'string'
    ? rawContent
    : JSON.stringify(rawContent || '', null, 2)

  if (!baseContent.trim() && images.length) {
    baseContent = `_Attached images:_ ${images.map((item) => item.filename || 'image').join(', ')}`
  }

  if (baseContent.trim() || (!tools.length && !images.length)) {
    visible.push(normalizeMessageShape(entry, baseId, baseContent))
  }

  tools.forEach((tool, toolIndex) => {
    const toolName = tool?.name || `tool-${toolIndex + 1}`
    const toolBaseId = `${baseId}-tool-${toolIndex}`

    if (tool?.input != null && String(tool.input).trim() !== '') {
      visible.push(
        normalizeMessageShape(
          entry,
          `${toolBaseId}-input`,
          formatStageMessage(`Tool Input: ${toolName}`, formatCodeBlock(tool.input, 'json')),
          {
            id: `${toolBaseId}-input`,
            role: 'system',
            label: 'tool input',
            messageKind: 'tool',
          },
        ),
      )
    }

    if (tool?.result != null && String(tool.result).trim() !== '') {
      visible.push(
        normalizeMessageShape(
          entry,
          `${toolBaseId}-result`,
          formatStageMessage(
            `${tool?.is_error ? 'Tool Error' : 'Tool Result'}: ${toolName}`,
            formatCodeBlock(tool.result, 'text'),
          ),
          {
            id: `${toolBaseId}-result`,
            role: 'system',
            label: tool?.is_error ? 'tool error' : 'tool result',
            messageKind: 'tool',
          },
        ),
      )
    }
  })

  return visible
}

function hydrateServerMessages(history) {
  const previousMessages = serverMessages.value
  let nextSeq = Math.max(
    messageSequence,
    ...previousMessages.map((entry) => Number(entry?._seq || 0)),
    ...localMessages.value.map((entry) => Number(entry?._seq || 0)),
    0,
  )

  const nextMessages = history.map((entry, index) => {
    const previousEntry = previousMessages[index]
    if (sameMessageEntry(previousEntry, entry) && previousEntry?._seq) {
      return { ...entry, _seq: previousEntry._seq }
    }
    nextSeq += 1
    return { ...entry, _seq: nextSeq }
  })

  messageSequence = Math.max(messageSequence, nextSeq)
  return nextMessages
}

function createLocalMessage(payload, { clearOnSync = false } = {}) {
  localMessageSequence += 1
  return {
    ...payload,
    id: `local-${localMessageSequence}`,
    _seq: nextMessageSequence(),
    timestamp: new Date().toLocaleTimeString(),
    clearOnSync,
  }
}

function pushLocalMessage(payload, options) {
  localMessages.value = [...localMessages.value, createLocalMessage(payload, options)]
}

function pushStageMessage(content, extra = {}) {
  pushLocalMessage(
    {
      role: 'assistant',
      label: extra.label || 'stage',
      messageKind: extra.messageKind || 'message',
      content,
      text: content,
      ...extra,
    },
    { clearOnSync: false },
  )
}

function updateLocalMessage(messageId, updater) {
  localMessages.value = localMessages.value.map((entry) => {
    if (entry.id !== messageId) return entry
    return typeof updater === 'function' ? updater(entry) : { ...entry, ...updater }
  })
}

function removeLocalMessage(messageId) {
  localMessages.value = localMessages.value.filter((entry) => entry.id !== messageId)
}

function clearSyncedLocalMessages() {
  localMessages.value = localMessages.value.filter((entry) => !entry.clearOnSync)
}

function clearStreamingMessage() {
  if (!streamingMessageId) return
  removeLocalMessage(streamingMessageId)
  streamingMessageId = ''
}

function ensureStreamingMessage(initialContent = 'Processing...') {
  if (streamingMessageId) {
    return streamingMessageId
  }
  const entry = createLocalMessage(
    {
      role: 'assistant',
      content: initialContent,
      text: initialContent,
      streaming: true,
    },
    { clearOnSync: true },
  )
  localMessages.value = [...localMessages.value, entry]
  streamingMessageId = entry.id
  return streamingMessageId
}

function setStreamingMessageContent(nextContent, extra = {}) {
  const messageId = ensureStreamingMessage(nextContent)
  updateLocalMessage(messageId, (entry) => ({
    ...entry,
    content: nextContent,
    text: nextContent,
    ...extra,
  }))
}

function appendStreamingMessageContent(chunk) {
  const messageId = ensureStreamingMessage('')
  updateLocalMessage(messageId, (entry) => {
    const previous = entry.text || entry.content || ''
    const shouldReplaceStatusText =
      previous === 'Processing...' || previous.startsWith('Using ')
    const nextContent = shouldReplaceStatusText ? chunk : `${previous}${chunk}`
    return {
      ...entry,
      content: nextContent,
      text: nextContent,
      streaming: true,
    }
  })
}

function buildAttachmentSummary(items) {
  if (!items.length) return ''
  return `\n\n_Attached images:_ ${items.map((item) => item.filename).join(', ')}`
}

function readJsonError(response) {
  return response
    .json()
    .then((data) => data?.error || response.statusText)
    .catch(() => response.statusText)
}

async function loadAgents() {
  const previousAgentId = selectedAgentId.value
  const data = await apiGet('/api/agents')
  const nextAgents = normalizeItems(data)
  agents.value = nextAgents

  if (previousAgentId && nextAgents.some((agent) => String(agent.id) === String(previousAgentId))) {
    selectedAgentId.value = previousAgentId
    return
  }

  if (!selectedAgentId.value && nextAgents.length) {
    selectedAgentId.value = nextAgents[0].id
    return
  }

  if (!nextAgents.length) {
    selectedAgentId.value = ''
  }
}

async function loadModels() {
  const data = await apiGet('/api/models?available=true')
  const models = Array.isArray(data?.models) ? data.models : []
  availableModels.value = models
    .filter((item) => item?.available !== false)
    .sort((left, right) => String(left.display_name || left.id).localeCompare(String(right.display_name || right.id)))
}

async function loadCommands() {
  try {
    const data = await apiGet('/api/commands')
    const commands = Array.isArray(data?.commands) ? data.commands : []
    slashCommands.value = commands.length ? commands : fallbackSlashCommands
  } catch {
    slashCommands.value = fallbackSlashCommands
  }
}

async function loadAgentSessions({ preferredSessionId = '' } = {}) {
  if (!selectedAgentId.value) {
    agentSessions.value = []
    selectedSessionId.value = ''
    return
  }

  try {
    const data = await apiGet(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/sessions`)
    const sessions = Array.isArray(data?.sessions) ? data.sessions : []
    agentSessions.value = sessions

    const preferred = preferredSessionId || selectedSessionId.value
    const matched = sessions.find((session) => String(session.session_id) === String(preferred))
    syncingSessionSelection = true
    selectedSessionId.value = matched?.session_id || sessions[0]?.session_id || ''
  } catch {
    agentSessions.value = []
    syncingSessionSelection = true
    selectedSessionId.value = ''
  } finally {
    syncingSessionSelection = false
  }
}

async function loadCurrentSession({ forceScroll = false } = {}) {
  if (!selectedAgentId.value) {
    serverMessages.value = []
    localMessages.value = []
    pendingAttachments.value = []
    hasUnreadMessages.value = false
    selectedSessionId.value = ''
    return
  }

  try {
    const data = await apiGet(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/session`)
    const history = data?.messages || data?.items || []
    const nextMessages = hydrateServerMessages(Array.isArray(history) ? history : [])
    const previousCount = serverMessages.value.length
    serverMessages.value = nextMessages
    if (data?.session_id) {
      syncingSessionSelection = true
      selectedSessionId.value = data.session_id
      syncingSessionSelection = false
    }
    clearSyncedLocalMessages()

    if (forceScroll) {
      scheduleMessageScroll('auto', { force: true })
      return
    }

    if (nextMessages.length > previousCount) {
      scheduleMessageScroll('smooth')
    }
  } catch {
    serverMessages.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const [statusData] = await Promise.all([
      apiGet('/api/status').catch(() => null),
      loadAgents(),
      loadModels(),
      loadCommands(),
    ])
    status.value = statusData
    await loadAgentSessions()
    await loadCurrentSession({ forceScroll: true })
  } catch (error) {
    message.error(`Failed to load chat page: ${error.message}`)
  } finally {
    loading.value = false
  }
}

function disconnectAgentSocket() {
  if (agentSocket) {
    agentSocket.close()
    agentSocket = null
  }
  socketAgentId = ''
  wsConnected.value = false
}

async function syncCurrentSessionAfterPush() {
  try {
    await loadCurrentSession({ forceScroll: true })
  } finally {
    sending.value = false
  }
}

async function handleSocketMessage(payload) {
  switch (payload?.type) {
    case 'connected':
      return
    case 'typing':
      if (payload.state === 'start') {
        pushStageMessage(formatStageMessage('Started', 'Agent is processing this turn.'), {
          label: 'phase',
          messageKind: 'phase',
        })
      }
      scheduleMessageScroll('smooth')
      return
    case 'phase': {
      const title = payload.phase ? `Phase: ${payload.phase}` : 'Phase update'
      pushStageMessage(formatStageMessage(title, payload.detail || ''), { label: 'phase', messageKind: 'phase' })
      scheduleMessageScroll('smooth')
      return
    }
    case 'tool_start':
      pushStageMessage(formatStageMessage(`Tool Start: ${payload.tool || 'tool'}`), {
        label: 'tool',
        messageKind: 'tool',
      })
      scheduleMessageScroll('smooth')
      return
    case 'tool_end':
      pushStageMessage(
        formatStageMessage(
          `Tool Input: ${payload.tool || 'tool'}`,
          formatCodeBlock(payload.input || '', 'json'),
        ),
        { label: 'tool', messageKind: 'tool' },
      )
      scheduleMessageScroll('smooth')
      return
    case 'tool_result': {
      const title = `${payload.is_error ? 'Tool Error' : 'Tool Result'}: ${payload.tool || 'tool'}`
      pushStageMessage(formatStageMessage(title, formatCodeBlock(payload.result || '', 'text')), {
        label: 'tool',
        messageKind: 'tool',
      })
      scheduleMessageScroll('smooth')
      return
    }
    case 'canvas':
      pushStageMessage(
        formatStageMessage(
          `Canvas: ${payload.title || 'Canvas'}`,
          payload.html ? formatCodeBlock(payload.html, 'html') : '',
        ),
        { label: 'canvas', messageKind: 'tool' },
      )
      scheduleMessageScroll('smooth')
      return
    case 'text_delta':
      appendStreamingMessageContent(payload.content || '')
      scheduleMessageScroll('smooth')
      return
    case 'response':
      pendingAttachments.value = []
      if (payload.content) {
        setStreamingMessageContent(payload.content, { streaming: false })
      }
      await syncCurrentSessionAfterPush()
      return
    case 'silent_complete':
      pendingAttachments.value = []
      await syncCurrentSessionAfterPush()
      return
    case 'error':
      clearStreamingMessage()
      sending.value = false
      pushLocalMessage(
        {
          role: 'system',
          content: `Error: ${payload.content || 'Unknown WebSocket error'}`,
        },
        { clearOnSync: false },
      )
      scheduleMessageScroll('smooth', { force: true })
      return
    case 'command_result':
      pushLocalMessage(
        {
          role: 'system',
          content: payload.message || 'Command executed.',
        },
        { clearOnSync: false },
      )
      scheduleMessageScroll('smooth', { force: true })
      return
    case 'agents_updated':
      if (Array.isArray(payload.agents)) {
        agents.value = payload.agents
      }
      return
    default:
      return
  }
}

async function ensureAgentSocket(agentId) {
  if (!agentId) {
    disconnectAgentSocket()
    return false
  }

  if (agentSocket && socketAgentId === String(agentId)) {
    if (agentSocket.isOpen()) {
      return true
    }
    try {
      await agentSocket.connect()
      return agentSocket.isOpen()
    } catch {
      return false
    }
  }

  disconnectAgentSocket()
  const nextAgentId = String(agentId)
  socketAgentId = nextAgentId

  agentSocket = openAgentSocket(nextAgentId, {
    onOpen: () => {
      if (selectedAgentId.value !== nextAgentId) return
      wsConnected.value = true
      void loadCurrentSession({ forceScroll: !serverMessages.value.length })
    },
    onMessage: (payload) => {
      if (selectedAgentId.value !== nextAgentId) return
      void handleSocketMessage(payload)
    },
    onClose: (_event, meta) => {
      if (selectedAgentId.value !== nextAgentId) return
      wsConnected.value = false
      if (!meta?.willReconnect) {
        agentSocket = null
        socketAgentId = ''
      }
    },
    onError: () => {
      if (selectedAgentId.value !== nextAgentId) return
      wsConnected.value = false
    },
  })

  try {
    await agentSocket.connect()
    return agentSocket.isOpen()
  } catch {
    wsConnected.value = false
    return false
  }
}

async function switchModel(modelId) {
  if (!selectedAgentId.value || !modelId) return
  const nextModel = availableModels.value.find((item) => item.id === modelId)
  switchingModel.value = true
  try {
    const payload = nextModel?.provider
      ? { model: nextModel.id, provider: nextModel.provider }
      : { model: modelId }
    const data = await apiPut(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/model`, payload)
    agents.value = agents.value.map((agent) => {
      if (String(agent.id) !== String(selectedAgentId.value)) return agent
      return {
        ...agent,
        model_name: data?.model || nextModel?.id || agent.model_name,
        model_provider: data?.provider || nextModel?.provider || agent.model_provider,
      }
    })
    message.success(`Switched model to ${data?.model || nextModel?.display_name || modelId}`)
  } catch (error) {
    message.error(`Model switch failed: ${error.message}`)
  } finally {
    switchingModel.value = false
  }
}

async function handleModelSelect(value) {
  await switchModel(value)
}

async function switchSession(sessionId) {
  if (!selectedAgentId.value || !sessionId) return
  switchingSession.value = true
  try {
    await apiPost(
      `/api/agents/${encodeURIComponent(selectedAgentId.value)}/sessions/${encodeURIComponent(sessionId)}/switch`,
      {},
    )
    clearStreamingMessage()
    sending.value = false
    hasUnreadMessages.value = false
    shouldAutoScroll.value = true
    localMessages.value = []
    pendingAttachments.value = []
    await loadAgentSessions({ preferredSessionId: sessionId })
    await loadCurrentSession({ forceScroll: true })
    message.success('Session switched.')
  } catch (error) {
    message.error(`Session switch failed: ${error.message}`)
    await loadAgentSessions()
    await loadCurrentSession({ forceScroll: true })
  } finally {
    switchingSession.value = false
  }
}

function handleToolVisibilityChange(nextValue) {
  showToolMessages.value = nextValue
  persistToolVisibilityPreference(nextValue)
}

function triggerAttachmentPicker() {
  if (!selectedAgentId.value) {
    message.warning('Select an agent first.')
    return
  }
  fileInputRef.value?.click()
}

async function uploadAttachment(file) {
  const response = await fetch(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/upload`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error(await readJsonError(response))
  }

  return response.json()
}

async function handleFileSelection(event) {
  const files = Array.from(event.target?.files || [])
  if (!files.length) return

  if (!selectedAgentId.value) {
    message.warning('Select an agent first.')
    event.target.value = ''
    return
  }

  uploading.value = true
  try {
    let uploadedCount = 0
    for (const file of files) {
      if (!(file.type || '').startsWith('image/')) {
        message.warning(`${file.name} was skipped. The current chat composer only sends image attachments.`)
        continue
      }
      const uploaded = await uploadAttachment(file)
      pendingAttachments.value = [
        ...pendingAttachments.value,
        {
          file_id: uploaded.file_id,
          filename: uploaded.filename,
          content_type: uploaded.content_type,
          size: uploaded.size,
        },
      ]
      uploadedCount += 1
    }
    if (uploadedCount > 0) {
      message.success('Attachment ready. Send a message to include it in the next turn.')
    }
  } catch (error) {
    message.error(`Upload failed: ${error.message}`)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

function removeAttachment(fileId) {
  pendingAttachments.value = pendingAttachments.value.filter((item) => item.file_id !== fileId)
}

function showHelpMessage() {
  const commandLines = (slashCommands.value.length ? slashCommands.value : fallbackSlashCommands)
    .map((item) => `- \`${item.cmd}\` - ${item.desc || 'No description'}`)
    .join('\n')

  pushLocalMessage(
    {
      role: 'system',
      content: `### Chat shortcuts\n\n${commandLines}\n\nYou can also switch models from the header and attach images before sending.`,
    },
    { clearOnSync: false },
  )
  scheduleMessageScroll('smooth', { force: true })
}

function showStatusMessage() {
  pushLocalMessage(
    {
      role: 'system',
      content: `### Current status\n\n- Runtime: \`${status.value?.runtime_status || status.value?.status || 'Online'}\`\n- Agent: \`${selectedAgent.value?.name || selectedAgent.value?.id || 'Unknown'}\`\n- Model: \`${currentModelLabel.value}\``,
    },
    { clearOnSync: false },
  )
  scheduleMessageScroll('smooth', { force: true })
}

async function resetSession() {
  if (!selectedAgentId.value) return
  try {
    await apiPost(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/session/reset`, {})
    serverMessages.value = []
    localMessages.value = []
    pendingAttachments.value = []
    hasUnreadMessages.value = false
    shouldAutoScroll.value = true
    message.success('Session reset.')
    await loadCurrentSession({ forceScroll: true })
  } catch (error) {
    message.error(`Reset failed: ${error.message}`)
  }
}

async function createNewSession() {
  if (!selectedAgentId.value) return
  try {
    const session = await apiPost(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/sessions`, {})
    serverMessages.value = []
    localMessages.value = []
    pendingAttachments.value = []
    hasUnreadMessages.value = false
    shouldAutoScroll.value = true
    message.success('Started a new session.')
    await loadAgentSessions({ preferredSessionId: session?.session_id || '' })
    await loadCurrentSession({ forceScroll: true })
  } catch (error) {
    message.error(`New session failed: ${error.message}`)
  }
}

async function compactSession() {
  if (!selectedAgentId.value) return
  try {
    const data = await apiPost(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/session/compact`, {})
    pushLocalMessage(
      {
        role: 'system',
        content: `### Session compaction\n\n${data?.message || 'Compaction requested.'}`,
      },
      { clearOnSync: false },
    )
    scheduleMessageScroll('smooth', { force: true })
  } catch (error) {
    message.error(`Compact failed: ${error.message}`)
  }
}

async function handleModelCommand(argument) {
  const query = argument.trim().toLowerCase()
  if (!query) {
    const preview = availableModels.value
      .slice(0, 6)
      .map((item) => `- \`${item.id}\` - ${item.display_name || item.id}`)
      .join('\n')
    pushLocalMessage(
      {
        role: 'system',
        content: `### Model switch\n\nCurrent model: \`${currentModelLabel.value}\`\n\nUse the selector in the header or run \`/model <id>\`.\n\n${preview}`,
      },
      { clearOnSync: false },
    )
    scheduleMessageScroll('smooth', { force: true })
    return
  }

  const matched = availableModels.value.find((item) => {
    const haystack = `${item.id} ${item.display_name || ''} ${item.provider}`.toLowerCase()
    return haystack.includes(query)
  })

  if (!matched) {
    pushLocalMessage(
      {
        role: 'system',
        content: `No available model matched \`${argument}\`. Try \`/help\` or use the model selector.`,
      },
      { clearOnSync: false },
    )
    scheduleMessageScroll('smooth', { force: true })
    return
  }

  await switchModel(matched.id)
}

async function executeSlashCommand(text) {
  const [command = '', ...rest] = text.trim().split(/\s+/)
  const argument = rest.join(' ')

  switch (command.toLowerCase()) {
    case '/help':
      showHelpMessage()
      return true
    case '/new':
      await createNewSession()
      return true
    case '/compact':
      await compactSession()
      return true
    case '/model':
      await handleModelCommand(argument)
      return true
    case '/status':
      showStatusMessage()
      return true
    case '/clear':
      localMessages.value = []
      hasUnreadMessages.value = false
      shouldAutoScroll.value = true
      message.success('Local helper messages cleared.')
      return true
    default:
      pushLocalMessage(
        {
          role: 'system',
          content: `\`${command}\` is listed for compatibility, but this page does not execute it yet.\n\nUse \`/help\` to see the currently supported shortcuts.`,
        },
        { clearOnSync: false },
      )
      scheduleMessageScroll('smooth', { force: true })
      return true
  }
}

function applySlashCommand(command) {
  input.value = `${command} `
}

async function sendMessage() {
  const text = input.value.trim()
  if (!selectedAgentId.value) return

  if (text.startsWith('/')) {
    input.value = ''
    await executeSlashCommand(text)
    return
  }

  if (!text) {
    if (pendingAttachments.value.length) {
      message.warning('Add a short prompt before sending attachments.')
    }
    return
  }

  const attachmentSnapshot = pendingAttachments.value.map((item) => ({ ...item }))
  sending.value = true
  input.value = ''
  const pendingUserMessage = createLocalMessage(
    {
      role: 'user',
      content: `${text}${buildAttachmentSummary(attachmentSnapshot)}`,
      text,
    },
    { clearOnSync: true },
  )
  localMessages.value = [...localMessages.value, pendingUserMessage]
  scheduleMessageScroll('smooth', { force: true })

  try {
    const wsReady = await ensureAgentSocket(selectedAgentId.value)
    if (wsReady && agentSocket?.send({
      type: 'message',
      content: text,
      attachments: attachmentSnapshot.map((item) => ({
        file_id: item.file_id,
        filename: item.filename,
        content_type: item.content_type,
      })),
    })) {
      pendingAttachments.value = []
      return
    }

    const data = await apiPost(`/api/agents/${encodeURIComponent(selectedAgentId.value)}/message`, {
      message: text,
      attachments: attachmentSnapshot.map((item) => ({
        file_id: item.file_id,
        filename: item.filename,
        content_type: item.content_type,
      })),
    })
    pendingAttachments.value = []
    pushLocalMessage(
      {
        role: 'assistant',
        content: data.response || '(no response)',
        text: data.response || '(no response)',
      },
      { clearOnSync: true },
    )
    scheduleMessageScroll('smooth', { force: true })
    await loadCurrentSession({ forceScroll: true })
  } catch (error) {
    localMessages.value = localMessages.value.filter((entry) => entry.id !== pendingUserMessage.id)
    input.value = text
    message.error(`Send failed: ${error.message}`)
  } finally {
    if (!agentSocket?.isOpen()) {
      sending.value = false
    }
  }
}

watch(selectedAgentId, async () => {
  disconnectAgentSocket()
  clearStreamingMessage()
  sending.value = false
  hasUnreadMessages.value = false
  shouldAutoScroll.value = true
  localMessages.value = []
  pendingAttachments.value = []
  agentSessions.value = []
  selectedSessionId.value = ''
  await loadAgentSessions()
  await loadCurrentSession({ forceScroll: true })
  await ensureAgentSocket(selectedAgentId.value)
})

watch(selectedSessionId, async (nextValue, previousValue) => {
  if (!nextValue || nextValue === previousValue || syncingSessionSelection) return
  await switchSession(nextValue)
})

watch(() => normalizedMessages.value.length, (nextLength, previousLength) => {
  if (nextLength > previousLength) {
    scheduleMessageScroll()
  }
})

onMounted(async () => {
  await loadData()
})

onBeforeUnmount(() => {
  disconnectAgentSocket()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
    <div class="shrink-0 rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-lg font-semibold text-slate-900">Chat</div>
          <div class="mt-0.5 text-sm text-slate-500">Slash commands and image attachments are available in the composer.</div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <a-tag color="blue">{{ headerStatusLabel }}</a-tag>
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
                  <div class="mt-1 text-xs text-slate-500">
                    {{ item.model_provider && item.model_name ? `${item.model_provider} / ${item.model_name}` : item.mode || 'Agent' }}
                  </div>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>

      <div class="min-h-0 overflow-hidden">
        <div class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <div class="mb-3 shrink-0 flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
                <div class="truncate text-sm font-semibold text-slate-900">{{ selectedAgent?.name || selectedAgent?.id || 'Conversation' }}</div>
                <div class="flex items-center gap-2 xl:w-[360px]">
                  <span class="shrink-0 text-xs text-slate-500">Session</span>
                  <a-select
                    :value="selectedSessionId || undefined"
                    :options="sessionOptions"
                    show-search
                    placeholder="Select session"
                    class="min-w-0 flex-1"
                    :loading="switchingSession || loading"
                    :filter-option="(search, option) => (option?.searchText || '').includes(search.toLowerCase())"
                    @change="(value) => { selectedSessionId = value }"
                  />
                </div>
              </div>
              <div class="mt-0.5 line-clamp-1 text-xs text-slate-500">
                {{ selectedAgentSubtitle || 'Select an agent to inspect and send a message.' }}
                <span v-if="selectedSessionId"> | {{ selectedSessionSummary }}</span>
              </div>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <a-tag color="blue">{{ normalizedMessages.length }} Messages</a-tag>
              <a-tag v-if="pendingAttachments.length" color="gold">{{ pendingAttachments.length }} Attachments</a-tag>
              <a-tag :color="wsConnected ? 'green' : 'default'">{{ wsConnected ? 'Live' : 'Offline' }}</a-tag>
            </div>
          </div>

          <div
            ref="messageListRef"
            class="relative mb-3 min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-4"
            @scroll="handleMessageListScroll"
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
                    : entry.role === 'system'
                      ? 'bg-amber-50 text-slate-800 ring-1 ring-amber-200'
                      : 'bg-white text-slate-800 ring-1 ring-slate-200'"
                >
                  <div class="mb-1 flex items-center gap-2 text-[11px] uppercase opacity-70">
                    <span>{{ entry.role }}</span>
                    <span v-if="entry.label && entry.label !== entry.role">- {{ entry.label }}</span>
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

            <a-button
              v-if="hasUnreadMessages"
              type="primary"
              size="small"
              class="absolute bottom-4 right-4 shadow-md"
              @click="scrollMessagesToBottom()"
            >
              New messages
            </a-button>
          </div>

          <div class="shrink-0 border-t border-slate-200 pt-3">
            <div class="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <a-button :icon="h(PlusOutlined)" @click="createNewSession">New session</a-button>
                <a-button :icon="h(PaperClipOutlined)" :loading="uploading" @click="triggerAttachmentPicker">Attach image</a-button>
                <div class="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">
                  <span class="text-xs text-slate-500">Show tools</span>
                  <a-switch size="small" :checked="showToolMessages" @change="handleToolVisibilityChange" />
                </div>
                <div class="text-xs text-slate-500">Type <code>/help</code> for command shortcuts. Images are uploaded first, then sent with your next message.</div>
              </div>
              <div class="flex items-center gap-2 xl:w-[360px] xl:justify-end">
                <span class="shrink-0 text-xs text-slate-500">Model</span>
                <a-select
                  :value="currentModelOptionId"
                  show-search
                  placeholder="Switch model"
                  class="min-w-0 flex-1 xl:max-w-[320px]"
                  :loading="switchingModel"
                  :options="modelOptions"
                  :filter-option="(search, option) => (option?.searchText || '').includes(search.toLowerCase())"
                  @change="handleModelSelect"
                />
              </div>
            </div>

            <div v-if="pendingAttachments.length" class="mb-3 flex flex-wrap gap-2">
              <div
                v-for="attachment in pendingAttachments"
                :key="attachment.file_id"
                class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
              >
                <span>{{ attachment.filename }}</span>
                <a-button type="text" size="small" :icon="h(CloseOutlined)" @click="removeAttachment(attachment.file_id)" />
              </div>
            </div>

            <div class="relative overflow-visible">
              <div
                v-if="showSlashMenu"
                class="absolute left-0 right-0 z-30 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                style="bottom: calc(100% + 8px);"
              >
                <div class="mb-2 px-2 text-xs font-medium text-slate-500">Commands</div>
                <button
                  v-for="command in filteredSlashCommands"
                  :key="command.cmd"
                  type="button"
                  class="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                  @click="applySlashCommand(command.cmd)"
                >
                  <span class="font-mono text-sm text-slate-800">{{ command.cmd }}</span>
                  <span class="ml-4 text-xs text-slate-500">{{ command.desc }}</span>
                </button>
              </div>

              <div class="flex gap-3">
                <a-textarea
                  v-model:value="input"
                  :auto-size="{ minRows: 2, maxRows: 5 }"
                  placeholder="Send a message, or type /help..."
                  @pressEnter.exact.prevent="sendMessage"
                />
                <a-button type="primary" :icon="h(SendOutlined)" :loading="sending" @click="sendMessage">Send</a-button>
              </div>
            </div>

            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              multiple
              style="display: none"
              @change="handleFileSelection"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
