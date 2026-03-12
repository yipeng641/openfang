import { describe, expect, it } from 'vitest'
import {
  getAccordionOpenKeys,
  hasUniqueMenuKeys,
  resolvePageFromHash,
  sectionKeys,
} from './navigation'

describe('navigation', () => {
  it('uses unique keys for sections and pages', () => {
    expect(hasUniqueMenuKeys()).toBe(true)
  })

  it('resolves legacy aliases to canonical pages', () => {
    expect(resolvePageFromHash('#chat')).toBe('agents')
    expect(resolvePageFromHash('#usage')).toBe('analytics')
    expect(resolvePageFromHash('#security')).toBe('settings')
  })

  it('falls back to agents for unknown hashes', () => {
    expect(resolvePageFromHash('#does-not-exist')).toBe('agents')
    expect(resolvePageFromHash('')).toBe('agents')
  })

  it('keeps only the latest expanded section', () => {
    expect(getAccordionOpenKeys([sectionKeys[0]])).toEqual([sectionKeys[0]])
    expect(getAccordionOpenKeys([sectionKeys[0], sectionKeys[1]])).toEqual([sectionKeys[1]])
    expect(getAccordionOpenKeys([])).toEqual([])
  })
})
