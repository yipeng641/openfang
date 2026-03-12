<script setup>
import { computed, h, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { apiGet } from '../api'
import { formatValue, getDisplayColumns, getPrimitiveEntries, normalizeItems, safeJson, summarizeData } from '../data-utils'

const props = defineProps({
  definition: {
    type: Object,
    required: true,
  },
})

const loading = ref(false)
const sections = ref([])

const pageTitle = computed(() => props.definition.title)
const pageDescription = computed(() => props.definition.description)

async function loadData() {
  loading.value = true
  try {
    const results = await Promise.all(
      props.definition.loaders.map(async (loader) => {
        try {
          const data = await apiGet(loader.path)
          return { ...loader, data, error: '' }
        } catch (error) {
          return { ...loader, data: null, error: error.message }
        }
      }),
    )
    sections.value = results
  } finally {
    loading.value = false
  }
}

function sectionMode(section) {
  const items = normalizeItems(section.data)
  if (items.length) return 'list'
  if (getPrimitiveEntries(section.data).length) return 'details'
  return 'json'
}

function sectionColumns(section) {
  return getDisplayColumns(normalizeItems(section.data)).map((column) => ({
    ...column,
    customRender: ({ value }) => formatValue(value),
  }))
}

function sectionRows(section) {
  return normalizeItems(section.data).map((item, index) => ({
    _row_key: item?.id || item?.name || item?.key || `${section.key}-${index}`,
    ...item,
  }))
}

function handleSectionError(section) {
  if (section.error) {
    message.error(`${section.title}: ${section.error}`)
  }
}

watch(() => props.definition, loadData, { immediate: true })
onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-xl font-semibold text-slate-900">{{ pageTitle }}</div>
          <div class="mt-1 text-sm text-slate-500">{{ pageDescription }}</div>
        </div>
        <a-button :icon="h(ReloadOutlined)" :loading="loading" @click="loadData">Refresh</a-button>
      </div>
    </div>

    <a-row :gutter="16">
      <a-col v-for="section in sections" :key="section.key" :xs="24" :xl="12" class="mb-4">
        <div class="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <div class="text-base font-semibold text-slate-900">{{ section.title }}</div>
              <div class="mt-1 text-sm text-slate-500">{{ summarizeData(section.data) }}</div>
            </div>
            <a-tag v-if="section.error" color="red" @click="handleSectionError(section)">Load Failed</a-tag>
            <a-tag v-else color="blue">Loaded</a-tag>
          </div>

          <div v-if="section.error" class="rounded-xl bg-rose-50 p-4 text-sm text-rose-600">
            {{ section.error }}
          </div>

          <template v-else-if="sectionMode(section) === 'list'">
            <a-table
              :columns="sectionColumns(section)"
              :data-source="sectionRows(section)"
              :pagination="{ pageSize: 6, hideOnSinglePage: true }"
              size="small"
              :scroll="{ x: 720 }"
              row-key="_row_key"
            />
          </template>

          <template v-else-if="sectionMode(section) === 'details'">
            <a-descriptions size="small" bordered :column="1">
              <a-descriptions-item v-for="([key, value]) in getPrimitiveEntries(section.data)" :key="key" :label="key">
                {{ formatValue(value) }}
              </a-descriptions-item>
            </a-descriptions>
          </template>

          <template v-else>
            <pre class="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{{ safeJson(section.data) }}</pre>
          </template>
        </div>
      </a-col>
    </a-row>
  </div>
</template>
