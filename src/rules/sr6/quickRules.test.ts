import { describe, expect, it } from 'vitest'
import { QUICK_RULES } from './quickRules'

describe('quick rules', () => {
  it('covers statuses, Edge actions and skills from the app', () => {
    const groups = new Set(QUICK_RULES.map((r) => r.group))
    expect(groups).toContain('Statuses')
    expect(groups).toContain('Edge action')
    expect(groups).toContain('Skill')
    expect(QUICK_RULES.every((r) => r.title && r.lines.length > 0)).toBe(true)
  })
})
