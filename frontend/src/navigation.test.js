import { describe, expect, it } from 'vitest'
import {
  getAccordionOpenKeys,
  getSectionForPage,
  hasUniqueMenuKeys,
  resolvePageKey,
  sectionKeys,
} from './navigation'

describe('navigation', () => {
  it('uses unique keys for sections and pages', () => {
    expect(hasUniqueMenuKeys()).toBe(true)
  })

  it('resolves known and unknown page keys', () => {
    expect(resolvePageKey('agents')).toBe('agents')
    expect(resolvePageKey('analytics')).toBe('analytics')
    expect(resolvePageKey('does-not-exist')).toBe('agents')
  })

  it('finds the section for a given page', () => {
    expect(getSectionForPage('overview').key).toBe('group-monitor')
    expect(getSectionForPage('providers').key).toBe('group-llm')
    expect(getSectionForPage('does-not-exist').key).toBe('group-chat')
  })

  it('keeps only the latest expanded section', () => {
    expect(getAccordionOpenKeys([sectionKeys[0]])).toEqual([sectionKeys[0]])
    expect(getAccordionOpenKeys([sectionKeys[0], sectionKeys[1]])).toEqual([sectionKeys[1]])
    expect(getAccordionOpenKeys([])).toEqual([])
  })
})
