<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet, apiPost } from '../api'

const loading = ref(false)
const loadError = ref('')
const activeTab = ref('installed')
const marketplaceTab = ref('clawhub')
const skills = ref([])
const configuredMcpServers = ref([])
const connectedMcpServers = ref([])
const clawHubQuery = ref('')
const clawHubSort = ref('trending')
const clawHubLoading = ref(false)
const clawHubError = ref('')
const clawHubResults = ref([])
const fangHubQuery = ref('')
const fangHubLoading = ref(false)
const fangHubError = ref('')
const fangHubResults = ref([])
const actionLoading = ref({})

const skillColumns = [
  { title: 'Skill', key: 'skill', ellipsis: true },
  { title: 'Runtime', dataIndex: 'runtime', key: 'runtime', width: 120 },
  { title: 'Source', key: 'source', width: 120 },
  { title: 'Tools', dataIndex: 'tools_count', key: 'tools_count', width: 90, align: 'center' },
  { title: 'Status', key: 'status', width: 110 },
  { title: 'Tags', key: 'tags', ellipsis: true },
  { title: 'Action', key: 'action', width: 140 },
]

const clawHubColumns = [
  { title: 'Skill', key: 'skill', ellipsis: true },
  { title: 'Version', dataIndex: 'version', key: 'version', width: 120 },
  { title: 'Signals', key: 'signals', width: 170 },
  { title: 'Updated', key: 'updated_at', width: 170 },
  { title: 'Action', key: 'action', width: 120 },
]

const fangHubColumns = [
  { title: 'Repository', key: 'repo', ellipsis: true },
  { title: 'Stars', dataIndex: 'stars', key: 'stars', width: 90, align: 'center' },
  { title: 'URL', key: 'url', ellipsis: true },
  { title: 'Action', key: 'action', width: 120 },
]

const mcpConfiguredColumns = [
  { title: 'Server', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Transport', key: 'transport', width: 120 },
  { title: 'Timeout', dataIndex: 'timeout_secs', key: 'timeout_secs', width: 110 },
  { title: 'Env Vars', key: 'env', width: 100, align: 'center' },
]

const mcpConnectedColumns = [
  { title: 'Server', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: 'Connected', key: 'connected', width: 110 },
  { title: 'Tools', dataIndex: 'tools_count', key: 'tools_count', width: 90, align: 'center' },
  { title: 'Tool Names', key: 'tool_names', ellipsis: true },
]

const bundledCount = computed(() => skills.value.filter((skill) => skill.source?.type === 'bundled').length)
const localCount = computed(() => skills.value.filter((skill) => !skill.source || skill.source.type === 'local').length)
const externalCount = computed(() => skills.value.filter((skill) => ['clawhub', 'openclaw'].includes(skill.source?.type)).length)
const promptOnlyCount = computed(() => skills.value.filter((skill) => String(skill.runtime).toLowerCase().includes('prompt')).length)
const installedSkillNames = computed(() => new Set(skills.value.map((skill) => String(skill.name || ''))))
const installedClawHubSlugs = computed(() => {
  return new Set(
    skills.value
      .filter((skill) => skill.source?.type === 'clawhub' && skill.source?.slug)
      .map((skill) => String(skill.source.slug)),
  )
})

function sourceLabel(skill) {
  const type = skill.source?.type || 'local'
  if (type === 'bundled') return 'Built-in'
  if (type === 'clawhub') return 'ClawHub'
  if (type === 'openclaw') return 'OpenClaw'
  return 'Local'
}

function sourceColor(skill) {
  const type = skill.source?.type || 'local'
  if (type === 'bundled') return 'success'
  if (type === 'clawhub') return 'processing'
  if (type === 'openclaw') return 'blue'
  return 'default'
}

function isRemovalAllowed(skill) {
  return skill.source?.type !== 'bundled'
}

function isInstalledClawHubSkill(record) {
  return installedClawHubSlugs.value.has(String(record.slug || '')) || installedSkillNames.value.has(String(record.name || ''))
}

function isInstalledFangHubSkill(record) {
  return installedSkillNames.value.has(String(record.name || ''))
}

function formatCount(value) {
  const amount = Number(value || 0)
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k`
  }
  return String(amount)
}

function formatUpdatedAt(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
}

function setActionLoading(key, value) {
  const next = { ...actionLoading.value }
  if (value) next[key] = true
  else delete next[key]
  actionLoading.value = next
}

function isActionLoading(key) {
  return Boolean(actionLoading.value[key])
}

function normalizeClawHubItems(items = []) {
  return items.map((item) => ({
    slug: item.slug,
    name: item.name,
    description: item.description,
    version: item.version || '-',
    score: item.score,
    stars: item.stars,
    downloads: item.downloads,
    updated_at: item.updated_at,
  }))
}

async function loadData() {
  loading.value = true
  loadError.value = ''

  const [skillsResult, mcpResult] = await Promise.allSettled([
    apiGet('/api/skills'),
    apiGet('/api/mcp/servers'),
  ])

  if (skillsResult.status === 'fulfilled') {
    skills.value = skillsResult.value.skills || []
  } else {
    skills.value = []
    loadError.value = skillsResult.reason.message
    message.error(`Failed to load skills: ${skillsResult.reason.message}`)
  }

  if (mcpResult.status === 'fulfilled') {
    configuredMcpServers.value = mcpResult.value.configured || []
    connectedMcpServers.value = mcpResult.value.connected || []
  } else {
    configuredMcpServers.value = []
    connectedMcpServers.value = []
    message.warning(`Failed to load MCP servers: ${mcpResult.reason.message}`)
  }

  loading.value = false
}

async function loadClawHubBrowse() {
  clawHubLoading.value = true
  clawHubError.value = ''
  try {
    const data = await apiGet(`/api/clawhub/browse?sort=${encodeURIComponent(clawHubSort.value)}&limit=20`)
    clawHubResults.value = normalizeClawHubItems(data.items || [])
    if (data.error) {
      clawHubError.value = data.error
    }
  } catch (error) {
    clawHubResults.value = []
    clawHubError.value = error.message
    message.error(`Failed to load ClawHub skills: ${error.message}`)
  } finally {
    clawHubLoading.value = false
  }
}

async function searchClawHub() {
  const query = clawHubQuery.value.trim()
  if (!query) {
    await loadClawHubBrowse()
    return
  }

  clawHubLoading.value = true
  clawHubError.value = ''
  try {
    const data = await apiGet(`/api/clawhub/search?q=${encodeURIComponent(query)}&limit=20`)
    clawHubResults.value = normalizeClawHubItems(data.items || [])
    if (data.error) {
      clawHubError.value = data.error
    }
  } catch (error) {
    clawHubResults.value = []
    clawHubError.value = error.message
    message.error(`ClawHub search failed: ${error.message}`)
  } finally {
    clawHubLoading.value = false
  }
}

async function searchFangHub() {
  const query = fangHubQuery.value.trim()
  if (!query) {
    fangHubResults.value = []
    fangHubError.value = ''
    return
  }

  fangHubLoading.value = true
  fangHubError.value = ''
  try {
    const data = await apiGet(`/api/marketplace/search?q=${encodeURIComponent(query)}`)
    fangHubResults.value = data.results || []
    if (data.error) {
      fangHubError.value = data.error
    }
  } catch (error) {
    fangHubResults.value = []
    fangHubError.value = error.message
    message.error(`FangHub search failed: ${error.message}`)
  } finally {
    fangHubLoading.value = false
  }
}

async function installClawHubSkill(record) {
  const key = `install:clawhub:${record.slug}`
  setActionLoading(key, true)
  try {
    const result = await apiPost('/api/clawhub/install', { slug: record.slug })
    message.success(`Installed ${result.name || record.name}`)
    if (Array.isArray(result.warnings) && result.warnings.length) {
      message.warning(`${result.warnings.length} install warning(s) reported. Inspect the skill details if needed.`)
    }
    await loadData()
  } catch (error) {
    message.error(`Install failed: ${error.message}`)
  } finally {
    setActionLoading(key, false)
  }
}

async function installFangHubSkill(record) {
  const key = `install:fanghub:${record.name}`
  setActionLoading(key, true)
  try {
    const result = await apiPost('/api/skills/install', { name: record.name })
    message.success(`Downloaded ${result.name || record.name}`)
    message.warning('FangHub install is currently experimental: the backend downloader may need manual verification before the skill becomes loadable.')
    await loadData()
  } catch (error) {
    message.error(`Install failed: ${error.message}`)
  } finally {
    setActionLoading(key, false)
  }
}

async function uninstallSkill(record) {
  const key = `uninstall:${record.name}`
  setActionLoading(key, true)
  try {
    await apiPost('/api/skills/uninstall', { name: record.name })
    message.success(`Removed ${record.name}`)
    await loadData()
  } catch (error) {
    message.error(`Uninstall failed: ${error.message}`)
  } finally {
    setActionLoading(key, false)
  }
}

async function handleRefresh() {
  await loadData()
  if (activeTab.value === 'marketplace') {
    if (marketplaceTab.value === 'clawhub') {
      await searchClawHub()
    } else if (fangHubQuery.value.trim()) {
      await searchFangHub()
    }
  }
}

watch(clawHubSort, () => {
  if (!clawHubQuery.value.trim()) {
    void loadClawHubBrowse()
  }
})

onMounted(async () => {
  await Promise.all([
    loadData(),
    loadClawHubBrowse(),
  ])
})
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-lg font-semibold text-slate-900">Skills</div>
          <div class="mt-1 text-sm text-slate-500">Browse installed skills, uninstall local packages, and install new skills from marketplace sources.</div>
        </div>
        <div class="flex items-center gap-2">
          <a-button @click="activeTab = 'marketplace'">Install Skill</a-button>
          <a-button :icon="h(ReloadOutlined)" :loading="loading || clawHubLoading || fangHubLoading" @click="handleRefresh">Refresh</a-button>
        </div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Installed</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ skills.length }}</div>
        <div class="mt-2 text-sm text-slate-500">Total skills on disk</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Built-in</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ bundledCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Bundled with the app</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">External</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ externalCount + localCount }}</div>
        <div class="mt-2 text-sm text-slate-500">Local or marketplace sourced</div>
      </div>
      <div class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">MCP Connected</div>
        <div class="mt-3 text-3xl font-semibold text-slate-900">{{ connectedMcpServers.length }}</div>
        <div class="mt-2 text-sm text-slate-500">{{ promptOnlyCount }} prompt-first skills</div>
      </div>
    </div>

    <div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="mb-4" />

      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="installed" :tab="`Installed Skills (${skills.length})`">
          <a-table
            :columns="skillColumns"
            :data-source="skills"
            :loading="loading"
            row-key="name"
            :pagination="{ pageSize: 10, hideOnSinglePage: true }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'skill'">
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ record.name }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ record.description || 'No description' }}</div>
                  <div class="mt-1 text-xs text-slate-400">v{{ record.version || '-' }} <span v-if="record.author">by {{ record.author }}</span></div>
                </div>
              </template>

              <template v-else-if="column.key === 'runtime'">
                <a-tag color="blue">{{ record.runtime || 'unknown' }}</a-tag>
              </template>

              <template v-else-if="column.key === 'source'">
                <a-tag :color="sourceColor(record)">{{ sourceLabel(record) }}</a-tag>
              </template>

              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.enabled === false ? 'default' : 'success'">{{ record.enabled === false ? 'Disabled' : 'Enabled' }}</a-tag>
              </template>

              <template v-else-if="column.key === 'tags'">
                <div class="flex flex-wrap gap-1">
                  <a-tag v-for="tag in (record.tags || []).slice(0, 4)" :key="tag">{{ tag }}</a-tag>
                  <span v-if="!record.tags || !record.tags.length" class="text-xs text-slate-400">No tags</span>
                </div>
              </template>

              <template v-else-if="column.key === 'action'">
                <a-popconfirm
                  v-if="isRemovalAllowed(record)"
                  :title="`Remove ${record.name}?`"
                  ok-text="Remove"
                  cancel-text="Cancel"
                  @confirm="uninstallSkill(record)"
                >
                  <a-button
                    danger
                    size="small"
                    :loading="isActionLoading(`uninstall:${record.name}`)"
                  >
                    Uninstall
                  </a-button>
                </a-popconfirm>
                <span v-else class="text-xs text-slate-400">Bundled</span>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="marketplace" tab="Marketplace">
          <a-tabs v-model:activeKey="marketplaceTab">
            <a-tab-pane key="clawhub" tab="ClawHub">
              <div class="space-y-4">
                <div class="rounded-2xl border border-slate-100 p-4">
                  <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div class="text-base font-semibold text-slate-900">ClawHub Catalog</div>
                      <div class="mt-1 text-sm text-slate-500">Recommended install source. Supports browse, semantic search, security checks, and skill conversion.</div>
                    </div>
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <a-select v-model:value="clawHubSort" class="w-full sm:w-[160px]">
                        <a-select-option value="trending">Trending</a-select-option>
                        <a-select-option value="downloads">Downloads</a-select-option>
                        <a-select-option value="stars">Stars</a-select-option>
                        <a-select-option value="updated">Updated</a-select-option>
                        <a-select-option value="rating">Rating</a-select-option>
                      </a-select>
                      <a-input-search
                        v-model:value="clawHubQuery"
                        allow-clear
                        placeholder="Search ClawHub skills"
                        class="w-full sm:w-[320px]"
                        enter-button="Search"
                        @search="searchClawHub"
                      />
                    </div>
                  </div>
                </div>

                <a-alert v-if="clawHubError" type="warning" show-icon :message="clawHubError" />

                <a-table
                  :columns="clawHubColumns"
                  :data-source="clawHubResults"
                  :loading="clawHubLoading"
                  row-key="slug"
                  :pagination="{ pageSize: 8, hideOnSinglePage: true }"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'skill'">
                      <div class="min-w-0">
                        <div class="truncate font-medium text-slate-900">{{ record.name }}</div>
                        <div class="mt-1 text-xs text-slate-500">{{ record.description || 'No description' }}</div>
                        <div class="mt-1 text-xs text-slate-400">{{ record.slug }}</div>
                      </div>
                    </template>

                    <template v-else-if="column.key === 'signals'">
                      <div class="text-xs text-slate-600">
                        <span v-if="record.score != null">Score {{ Number(record.score).toFixed(2) }}</span>
                        <span v-else>Stars {{ formatCount(record.stars) }} · Downloads {{ formatCount(record.downloads) }}</span>
                      </div>
                    </template>

                    <template v-else-if="column.key === 'updated_at'">
                      {{ formatUpdatedAt(record.updated_at) }}
                    </template>

                    <template v-else-if="column.key === 'action'">
                      <a-button
                        type="primary"
                        size="small"
                        :disabled="isInstalledClawHubSkill(record)"
                        :loading="isActionLoading(`install:clawhub:${record.slug}`)"
                        @click="installClawHubSkill(record)"
                      >
                        {{ isInstalledClawHubSkill(record) ? 'Installed' : 'Install' }}
                      </a-button>
                    </template>
                  </template>
                </a-table>
              </div>
            </a-tab-pane>

            <a-tab-pane key="fanghub" tab="FangHub">
              <div class="space-y-4">
                <a-alert
                  type="warning"
                  show-icon
                  message="Experimental source"
                  description="FangHub search and download are wired up, but the current backend installer only performs a shallow download. Prefer ClawHub when you need a skill to become usable immediately."
                />

                <div class="rounded-2xl border border-slate-100 p-4">
                  <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div class="text-base font-semibold text-slate-900">FangHub Search</div>
                      <div class="mt-1 text-sm text-slate-500">Search the GitHub-backed marketplace by repository name.</div>
                    </div>
                    <a-input-search
                      v-model:value="fangHubQuery"
                      allow-clear
                      placeholder="Search FangHub repositories"
                      class="w-full xl:w-[360px]"
                      enter-button="Search"
                      @search="searchFangHub"
                    />
                  </div>
                </div>

                <a-alert v-if="fangHubError" type="warning" show-icon :message="fangHubError" />

                <a-table
                  :columns="fangHubColumns"
                  :data-source="fangHubResults"
                  :loading="fangHubLoading"
                  row-key="name"
                  :pagination="{ pageSize: 8, hideOnSinglePage: true }"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'repo'">
                      <div class="min-w-0">
                        <div class="truncate font-medium text-slate-900">{{ record.name }}</div>
                        <div class="mt-1 text-xs text-slate-500">{{ record.description || 'No description' }}</div>
                      </div>
                    </template>

                    <template v-else-if="column.key === 'url'">
                      <a :href="record.url" target="_blank" rel="noreferrer" class="text-xs text-blue-600">{{ record.url }}</a>
                    </template>

                    <template v-else-if="column.key === 'action'">
                      <a-button
                        size="small"
                        :disabled="isInstalledFangHubSkill(record)"
                        :loading="isActionLoading(`install:fanghub:${record.name}`)"
                        @click="installFangHubSkill(record)"
                      >
                        {{ isInstalledFangHubSkill(record) ? 'Installed' : 'Download' }}
                      </a-button>
                    </template>
                  </template>
                </a-table>
              </div>
            </a-tab-pane>
          </a-tabs>
        </a-tab-pane>

        <a-tab-pane key="mcp" :tab="`MCP Servers (${configuredMcpServers.length}/${connectedMcpServers.length})`">
          <div class="grid gap-4 xl:grid-cols-2">
            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <div class="text-base font-semibold text-slate-900">Configured Servers</div>
                  <div class="mt-1 text-sm text-slate-500">Entries declared in config.</div>
                </div>
                <a-tag color="blue">{{ configuredMcpServers.length }}</a-tag>
              </div>

              <a-table
                :columns="mcpConfiguredColumns"
                :data-source="configuredMcpServers"
                :pagination="{ pageSize: 6, hideOnSinglePage: true }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'transport'">
                    <a-tag>{{ record.transport?.type || '-' }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'env'">
                    {{ Object.keys(record.env || {}).length }}
                  </template>
                </template>
              </a-table>
            </div>

            <div class="rounded-2xl border border-slate-100 p-4">
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <div class="text-base font-semibold text-slate-900">Connected Servers</div>
                  <div class="mt-1 text-sm text-slate-500">Live MCP connections and exposed tools.</div>
                </div>
                <a-tag color="success">{{ connectedMcpServers.length }}</a-tag>
              </div>

              <a-table
                :columns="mcpConnectedColumns"
                :data-source="connectedMcpServers"
                :pagination="{ pageSize: 6, hideOnSinglePage: true }"
                row-key="name"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'connected'">
                    <a-tag :color="record.connected ? 'success' : 'default'">{{ record.connected ? 'Connected' : 'Offline' }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'tool_names'">
                    <div class="text-xs text-slate-600">
                      {{ (record.tools || []).slice(0, 3).map((tool) => tool.name).join(', ') || 'No tools reported' }}
                    </div>
                  </template>
                </template>
              </a-table>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>
