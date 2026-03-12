<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import NativePageHost from './components/NativePageHost.vue'
import {
  getAccordionOpenKeys,
  pageCatalog,
  resolvePageFromHash,
  sections,
} from './navigation'

const openKeys = ref([])
const currentPage = ref(resolvePageFromHash(window.location.hash))

function syncFromHash() {
  const resolved = resolvePageFromHash(window.location.hash)
  if (resolved !== window.location.hash.replace(/^#/, '').trim().toLowerCase()) {
    window.location.hash = resolved
  }
  currentPage.value = resolved
}

function selectPage({ key }) {
  window.location.hash = key
  currentPage.value = key
}

function handleOpenChange(nextOpenKeys) {
  openKeys.value = getAccordionOpenKeys(nextOpenKeys)
}

const currentMeta = computed(() => pageCatalog.find((page) => page.key === currentPage.value) || pageCatalog[0])
const currentSection = computed(() => sections.find((section) => section.children.some((page) => page.key === currentPage.value)) || sections[0])

onMounted(() => {
  syncFromHash()
  window.addEventListener('hashchange', syncFromHash)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncFromHash)
})
</script>

<template>
  <a-layout class="h-screen overflow-hidden bg-slate-100">
    <a-layout-sider :width="256" theme="light" class="h-full overflow-hidden border-r border-slate-200">
      <div class="border-b border-slate-200 px-5 py-5">
        <div class="text-lg font-semibold tracking-wide text-slate-900">OpenFang</div>
        <div class="mt-1 text-sm text-slate-500">Grouped navigation</div>
      </div>

      <a-menu
        :open-keys="openKeys"
        :selected-keys="[currentPage]"
        mode="inline"
        class="h-[calc(100%-85px)] overflow-y-auto border-r-0 px-2 py-3"
        @select="selectPage"
        @update:openKeys="handleOpenChange"
      >
        <a-sub-menu v-for="section in sections" :key="section.key">
          <template #title>
            <span class="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {{ section.label }}
            </span>
          </template>

          <a-menu-item v-for="item in section.children" :key="item.key">
            <template #icon>
              <component :is="item.icon" />
            </template>
            {{ item.label }}
          </a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout class="h-full min-h-0 overflow-hidden">
      <a-layout-header class="shrink-0 !h-auto border-b border-slate-200 !bg-white px-6 py-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ currentSection.label }}</div>
            <div class="mt-1 text-lg font-semibold text-slate-900">{{ currentMeta.label }}</div>
            <div class="text-sm text-slate-500">{{ currentMeta.desc }}</div>
          </div>
          <div class="flex items-center gap-2">
            <a-tag color="green">Native Vue</a-tag>
            <a-tag color="blue">/app</a-tag>
          </div>
        </div>
      </a-layout-header>

      <a-layout-content class="min-h-0 flex-1 overflow-auto px-5 py-5 xl:px-6">
        <div class="h-full w-full max-w-none">
          <NativePageHost :page="currentPage" />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
