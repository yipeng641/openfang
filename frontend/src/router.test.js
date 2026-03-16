// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter, routes } from './router'
import { pageCatalog } from './navigation'

beforeAll(() => {
  window.scrollTo = () => {}
})

describe('router', () => {
  it('registers an explicit lazy-loaded component for every page', () => {
    for (const page of pageCatalog) {
      const route = routes.find((candidate) => candidate.name === page.key)
      expect(route, `missing route for ${page.key}`).toBeTruthy()
      expect(typeof route.component).toBe('function')
      expect(route.props).toBeUndefined()
    }
  })

  it('redirects root to agents', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('agents')
    expect(router.currentRoute.value.path).toBe('/agents')
  })

  it('redirects unknown paths to agents', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/not-found')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('agents')
  })
})
