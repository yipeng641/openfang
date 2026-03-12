<script setup>
import { computed } from 'vue'
import ChatPage from './ChatPage.vue'
import ApprovalsPage from './ApprovalsPage.vue'
import LogsPage from './LogsPage.vue'
import ModelsPage from './ModelsPage.vue'
import NativeDataPage from './NativeDataPage.vue'
import ProvidersPage from './ProvidersPage.vue'
import SessionsPage from './SessionsPage.vue'
import { nativePageDefinitions } from '../native-pages'

const props = defineProps({
  page: {
    type: String,
    required: true,
  },
})

const definition = computed(() => nativePageDefinitions[props.page] || null)
</script>

<template>
  <ProvidersPage v-if="page === 'providers'" />
  <ModelsPage v-else-if="page === 'models'" />
  <ChatPage v-else-if="page === 'agents'" />
  <ApprovalsPage v-else-if="page === 'approvals'" />
  <LogsPage v-else-if="page === 'logs'" />
  <SessionsPage v-else-if="page === 'sessions'" />
  <NativeDataPage v-else-if="definition" :definition="definition" />
  <div v-else class="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
    Unknown page: {{ page }}
  </div>
</template>
