export const nativePageDefinitions = {
  overview: {
    title: 'Overview',
    description: 'System health, usage, and recent activity.',
    loaders: [
      { key: 'health', title: 'Health', path: '/api/health' },
      { key: 'status', title: 'Status', path: '/api/status' },
      { key: 'usage', title: 'Usage', path: '/api/usage' },
      { key: 'audit', title: 'Recent Audit', path: '/api/audit/recent?n=20' },
      { key: 'channels', title: 'Channels', path: '/api/channels' },
      { key: 'providers', title: 'Providers', path: '/api/providers' },
      { key: 'skills', title: 'Skills', path: '/api/skills' },
    ],
  },
  analytics: {
    title: 'Analytics',
    description: 'Usage summary, model breakdown, and daily activity.',
    loaders: [
      { key: 'summary', title: 'Usage Summary', path: '/api/usage/summary' },
      { key: 'by-model', title: 'Usage by Model', path: '/api/usage/by-model' },
      { key: 'usage', title: 'Usage Records', path: '/api/usage' },
      { key: 'daily', title: 'Daily Usage', path: '/api/usage/daily' },
    ],
  },
  comms: {
    title: 'Comms',
    description: 'Agent topology and recent inter-agent events.',
    loaders: [
      { key: 'topology', title: 'Topology', path: '/api/comms/topology' },
      { key: 'events', title: 'Recent Events', path: '/api/comms/events?limit=200' },
    ],
  },
  workflows: {
    title: 'Workflows',
    description: 'Workflow definitions and recent executions.',
    loaders: [
      { key: 'workflows', title: 'Workflow List', path: '/api/workflows' },
    ],
  },
  scheduler: {
    title: 'Scheduler',
    description: 'Cron jobs and trigger definitions.',
    loaders: [
      { key: 'jobs', title: 'Cron Jobs', path: '/api/cron/jobs' },
      { key: 'triggers', title: 'Triggers', path: '/api/triggers' },
    ],
  },
  channels: {
    title: 'Channels',
    description: 'Messaging channel integrations and health.',
    loaders: [
      { key: 'channels', title: 'Configured Channels', path: '/api/channels' },
    ],
  },
  skills: {
    title: 'Skills',
    description: 'Installed skills and available MCP servers.',
    loaders: [
      { key: 'skills', title: 'Installed Skills', path: '/api/skills' },
      { key: 'mcp', title: 'MCP Servers', path: '/api/mcp/servers' },
    ],
  },
  hands: {
    title: 'Hands',
    description: 'Hands capabilities and active instances.',
    loaders: [
      { key: 'hands', title: 'Hands Catalog', path: '/api/hands' },
      { key: 'active', title: 'Active Hands', path: '/api/hands/active' },
    ],
  },
  runtime: {
    title: 'Runtime',
    description: 'Runtime version, status, tools, and agent overview.',
    loaders: [
      { key: 'status', title: 'Runtime Status', path: '/api/status' },
      { key: 'version', title: 'Version', path: '/api/version' },
      { key: 'tools', title: 'Tools', path: '/api/tools' },
      { key: 'agents', title: 'Agents', path: '/api/agents' },
    ],
  },
  settings: {
    title: 'Settings',
    description: 'Current config, schema, and security data.',
    loaders: [
      { key: 'config', title: 'Config', path: '/api/config' },
      { key: 'schema', title: 'Config Schema', path: '/api/config/schema' },
      { key: 'security', title: 'Security', path: '/api/security' },
      { key: 'peers', title: 'Peers', path: '/api/peers' },
    ],
  },
  wizard: {
    title: 'Wizard',
    description: 'First-run readiness across providers, channels, and agents.',
    loaders: [
      { key: 'providers', title: 'Providers', path: '/api/providers' },
      { key: 'channels', title: 'Channels', path: '/api/channels' },
      { key: 'agents', title: 'Agents', path: '/api/agents' },
    ],
  },
}
