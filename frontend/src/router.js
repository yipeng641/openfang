import { createRouter, createWebHistory } from 'vue-router'
import { pageCatalog } from './navigation'

const pageComponents = {
  overview: () => import('./components/OverviewPage.vue'),
  analytics: () => import('./components/AnalyticsPage.vue'),
  comms: () => import('./components/CommsPage.vue'),
  providers: () => import('./components/ProvidersPage.vue'),
  models: () => import('./components/ModelsPage.vue'),
  agents: () => import('./components/ChatPage.vue'),
  approvals: () => import('./components/ApprovalsPage.vue'),
  logs: () => import('./components/LogsPage.vue'),
  sessions: () => import('./components/SessionsPage.vue'),
  workflows: () => import('./components/WorkflowsPage.vue'),
  scheduler: () => import('./components/SchedulerPage.vue'),
  channels: () => import('./components/ChannelsPage.vue'),
  skills: () => import('./components/SkillsPage.vue'),
  hands: () => import('./components/HandsPage.vue'),
  runtime: () => import('./components/RuntimePage.vue'),
  settings: () => import('./components/SettingsPage.vue'),
  wizard: () => import('./components/WizardPage.vue'),
}

function resolveRouteComponent(pageKey) {
  const component = pageComponents[pageKey]
  if (!component) {
    throw new Error(`Missing route component for page "${pageKey}"`)
  }
  return component
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
