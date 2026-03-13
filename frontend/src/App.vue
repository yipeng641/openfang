<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getAccordionOpenKeys,
  getSectionForPage,
  pageCatalog,
  resolvePageKey,
  sections,
} from './navigation'

const route = useRoute()
const router = useRouter()
const openKeys = ref([])
const currentPage = computed(() => resolvePageKey(route.name))

function selectPage({ key }) {
  router.push({ name: key })
}

function handleOpenChange(nextOpenKeys) {
  openKeys.value = getAccordionOpenKeys(nextOpenKeys)
}

const currentMeta = computed(() => pageCatalog.find((page) => page.key === currentPage.value) || pageCatalog[0])
const currentSection = computed(() => getSectionForPage(currentPage.value))

watch(
  currentSection,
  (section) => {
    openKeys.value = [section.key]
  },
  { immediate: true },
)
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
      <a-layout-header class="shrink-0 !h-auto border-b border-slate-200 !bg-white px-5 py-1.5">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-slate-400">{{ currentSection.label }}</span>
          <span class="text-slate-300">/</span>
          <span class="font-medium text-slate-800">{{ currentMeta.label }}</span>
        </div>
      </a-layout-header>

      <a-layout-content class="min-h-0 flex-1 overflow-auto px-5 py-5 xl:px-6">
        <div class="h-full w-full max-w-none">
          <router-view />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
