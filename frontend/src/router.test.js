// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter, routes } from './router'

beforeAll(() => {
  window.scrollTo = () => {}
})

describe('router', () => {
  it('registers lazy-loaded route components', () => {
    const overviewRoute = routes.find((route) => route.name === 'overview')
    const analyticsRoute = routes.find((route) => route.name === 'analytics')
    const runtimeRoute = routes.find((route) => route.name === 'runtime')

    expect(typeof overviewRoute.component).toBe('function')
    expect(typeof analyticsRoute.component).toBe('function')
    expect(runtimeRoute.props).toEqual(expect.objectContaining({
      definition: expect.objectContaining({ title: 'Runtime' }),
    }))
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
