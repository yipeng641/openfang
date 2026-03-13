import { createRouter, createWebHistory } from 'vue-router'
import { nativePageDefinitions } from './native-pages'
import { pageCatalog } from './navigation'

const directPageImports = {
  overview: () => import('./components/OverviewPage.vue'),
  analytics: () => import('./components/AnalyticsPage.vue'),
  comms: () => import('./components/CommsPage.vue'),
  providers: () => import('./components/ProvidersPage.vue'),
  models: () => import('./components/ModelsPage.vue'),
  agents: () => import('./components/ChatPage.vue'),
  approvals: () => import('./components/ApprovalsPage.vue'),
  logs: () => import('./components/LogsPage.vue'),
  sessions: () => import('./components/SessionsPage.vue'),
}

function resolveRouteComponent(pageKey) {
  return directPageImports[pageKey] || (() => import('./components/NativeDataPage.vue'))
}

function resolveRouteProps(pageKey) {
  if (directPageImports[pageKey]) {
    return undefined
  }

  return {
    definition: nativePageDefinitions[pageKey],
  }
}

export const routes = [
  {
    path: '/',
    redirect: '/agents',
  },
  ...pageCatalog.map((page) => ({
    path: `/${page.key}`,
    name: page.key,
    component: resolveRouteComponent(page.key),
    props: resolveRouteProps(page.key),
  })),
  {
    path: '/:pathMatch(.*)*',
    redirect: '/agents',
  },
]

export function createAppRouter(history = createWebHistory(import.meta.env.BASE_URL)) {
  return createRouter({
    history,
    routes,
    scrollBehavior() {
      return { left: 0, top: 0 }
    },
  })
}

const router = createAppRouter()

export default router
