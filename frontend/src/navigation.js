import {
  AppstoreOutlined,
  AuditOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LinkOutlined,
  MessageOutlined,
  RocketOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UsergroupAddOutlined,
  TeamOutlined,
} from '@ant-design/icons-vue'

export const sections = [
  {
    key: 'group-chat',
    label: 'Chat',
    children: [
      { key: 'agents', label: 'Chat', icon: MessageOutlined, native: false, desc: 'Agent list, chat, and details.' },
    ],
  },
  {
    key: 'group-monitor',
    label: 'Monitor',
    children: [
      { key: 'overview', label: 'Overview', icon: DashboardOutlined, native: false, desc: 'System overview and status panels.' },
      { key: 'analytics', label: 'Analytics', icon: AuditOutlined, native: false, desc: 'Usage and cost analytics.' },
      { key: 'logs', label: 'Logs', icon: FileSearchOutlined, native: false, desc: 'Live logs and audit trail.' },
    ],
  },
  {
    key: 'group-agents',
    label: 'Agents',
    children: [
      { key: 'sessions', label: 'Sessions', icon: FileTextOutlined, native: false, desc: 'Session and memory browsing.' },
      { key: 'approvals', label: 'Approvals', icon: CheckSquareOutlined, native: false, desc: 'Pending approvals.' },
      { key: 'comms', label: 'Comms', icon: TeamOutlined, native: false, desc: 'Communications and messages.' },
    ],
  },
  {
    key: 'group-automation',
    label: 'Automation',
    children: [
      { key: 'workflows', label: 'Workflows', icon: ClusterOutlined, native: false, desc: 'Workflow list and visual builder.' },
      { key: 'scheduler', label: 'Scheduler', icon: CalendarOutlined, native: false, desc: 'Schedules, triggers, and history.' },
    ],
  },
  {
    key: 'group-extensions',
    label: 'Extensions',
    children: [
      { key: 'channels', label: 'Channels', icon: LinkOutlined, native: false, desc: 'Channel integrations.' },
      { key: 'skills', label: 'Skills', icon: RocketOutlined, native: false, desc: 'Skills and ClawHub.' },
      { key: 'hands', label: 'Hands', icon: ThunderboltOutlined, native: false, desc: 'Hands capabilities and activation.' },
    ],
  },
  {
    key: 'group-llm',
    label: 'LLM',
    children: [
      { key: 'providers', label: 'Providers', icon: DatabaseOutlined, native: true, desc: 'Native Vue provider management.' },
      { key: 'models', label: 'Models', icon: AppstoreOutlined, native: true, desc: 'Native Vue model management.' },
    ],
  },
  {
    key: 'group-system',
    label: 'System',
    children: [
      { key: 'runtime', label: 'Runtime', icon: ExperimentOutlined, native: false, desc: 'Runtime status and system info.' },
      { key: 'settings', label: 'Settings', icon: SettingOutlined, native: false, desc: 'Legacy settings page.' },
      { key: 'wizard', label: 'Wizard', icon: UsergroupAddOutlined, native: false, desc: 'Setup wizard.' },
    ],
  },
]

export const redirects = {
  chat: 'agents',
  templates: 'agents',
  triggers: 'workflows',
  cron: 'scheduler',
  schedules: 'scheduler',
  memory: 'sessions',
  audit: 'logs',
  security: 'settings',
  peers: 'settings',
  migration: 'settings',
  usage: 'analytics',
  approval: 'approvals',
}

export const pageCatalog = sections.flatMap((section) => section.children)
export const sectionKeys = sections.map((section) => section.key)

export function resolvePageFromHash(hashValue) {
  let hash = (hashValue || '').replace(/^#/, '').trim().toLowerCase() || 'agents'
  if (redirects[hash]) {
    hash = redirects[hash]
  }
  if (pageCatalog.some((page) => page.key === hash)) {
    return hash
  }
  return 'agents'
}

export function getAccordionOpenKeys(nextOpenKeys) {
  const validKeys = nextOpenKeys.filter((key) => sectionKeys.includes(key))
  if (!validKeys.length) {
    return []
  }
  return [validKeys[validKeys.length - 1]]
}

export function hasUniqueMenuKeys() {
  const allKeys = [
    ...sectionKeys,
    ...pageCatalog.map((page) => page.key),
  ]
  return new Set(allKeys).size === allKeys.length
}
