import { describe, expect, it } from 'vitest'
import { filterCommsEvents, formatCommsTime, normalizeCommsEvents, normalizeTopology } from './comms-utils'

describe('comms utils', () => {
  it('formats topology and events', () => {
    const topology = normalizeTopology({
      nodes: [{ id: 'a1', name: 'planner', state: 'Running', model: 'gpt-4' }],
      edges: [{ from: 'a1', to: 'a2', kind: 'peer' }],
    })

    expect(topology.nodes[0].name).toBe('planner')
    expect(topology.edges[0].kind).toBe('peer')

    const events = normalizeCommsEvents([
      { id: '1', timestamp: '2026-03-13T10:00:00Z', kind: 'agent_message', source_name: 'planner', target_name: 'worker', detail: 'hello' },
    ])
    expect(events[0].sourceName).toBe('planner')
  })

  it('filters events and formats time', () => {
    const events = normalizeCommsEvents([
      { id: '1', timestamp: '2026-03-13T10:00:00Z', kind: 'agent_message', source_name: 'planner', target_name: 'worker', detail: 'hello' },
      { id: '2', timestamp: '2026-03-13T11:00:00Z', kind: 'task_completed', source_name: 'lead', target_name: 'worker', detail: 'done' },
    ])

    expect(filterCommsEvents(events, 'planner')).toHaveLength(1)
    expect(formatCommsTime('2026-03-13T10:00:00Z')).toMatch(/^2026\/\d{2}\/\d{2} /)
  })
})
