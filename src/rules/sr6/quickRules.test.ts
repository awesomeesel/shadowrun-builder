import { describe, expect, it } from 'vitest'
import { QUICK_RULES, searchQuickRules, type QuickRule } from './quickRules'

describe('quick rules search', () => {
  const rules: QuickRule[] = [
    { group: 'Combat', title: 'Taking cover', lines: ['Hide behind things.'] },
    { group: 'Statuses', title: 'Cover', lines: ['Adds dice to defense.'] },
    { group: 'Playing', title: 'Defense', lines: ['Roll to avoid being hit; cover helps.'] },
  ]

  it('puts titles that start with the query first, then other titles, then mentions', () => {
    expect(searchQuickRules('cover', rules).map((r) => r.title)).toEqual(['Cover', 'Taking cover', 'Defense'])
  })

  it('needs every word, in any order', () => {
    expect(searchQuickRules('defense dice', rules).map((r) => r.title)).toEqual(['Cover'])
    expect(searchQuickRules('  ', rules)).toEqual([])
  })

  it('covers statuses, Edge actions and skills from the app', () => {
    const groups = new Set(QUICK_RULES.map((r) => r.group))
    expect(groups).toContain('Statuses')
    expect(groups).toContain('Edge action')
    expect(groups).toContain('Skill')
    expect(searchQuickRules('burning')[0].title).toMatch(/^Burning/)
  })
})
