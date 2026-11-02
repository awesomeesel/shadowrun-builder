import { describe, expect, it } from 'vitest'
import { highlight, SearchIndex, snippet, stem, terms, type SearchDoc } from './search'

const doc = (id: string, title: string, lines: string[], kind: SearchDoc['kind'] = 'section'): SearchDoc => ({
  id,
  kind,
  label: kind,
  title,
  path: [],
  lines,
})

describe('stemming', () => {
  it('matches common word forms', () => {
    expect(['cover', 'covers', 'covered', 'covering'].map(stem)).toEqual(['cover', 'cover', 'cover', 'cover'])
    expect(['status', 'statuses'].map(stem)).toEqual(['status', 'status'])
    expect(['burn', 'burning', 'abilities', 'ability'].map(stem)).toEqual(['burn', 'burn', 'ability', 'ability'])
    expect(terms('Running, stopped!')).toEqual(['run', 'stop'])
  })
})

describe('ranked search', () => {
  const docs = [
    doc('credits', 'Credits', ['Writing: Someone. Cover Art: Someone Else. Editing: A Third Person.']),
    doc('story', 'A Night Out', [
      'She was covering us while we ran across the street, and the rain kept falling all night long.',
    ]),
    doc('status', 'Cover', ['Each level adds to Defense Rating and defense dice.']),
    doc('minor', 'Minor actions', ['Drop Prone: lie down.', 'Take Cover: get behind something solid.', 'Stand Up.']),
    doc('called', 'Called Shot', ['Aim for a weak spot.']),
    doc('drain', 'Drain', ['Resist it with your tradition’s attributes after casting.']),
  ]
  const build = () => SearchIndex.build(docs)

  it('puts a heading match above passing mentions', async () => {
    const results = (await build()).search('cover ')
    expect(results[0].doc.id).toBe('status')
    expect(results.map((r) => r.doc.id)).toContain('story')
  })

  it('needs every word when something has them all, and rewards the phrase', async () => {
    const index = await build()
    expect(index.search('called shot ').map((r) => r.doc.id)).toEqual(['called'])
    expect(index.search('drain resist ')[0].doc.id).toBe('drain')
  })

  it('matches the last word while it’s being typed', async () => {
    expect((await build()).search('cov')[0].doc.id).toBe('status')
  })

  it('doesn’t let a longer word outrank a complete one', async () => {
    const index = await SearchIndex.build([
      ...docs,
      doc('covert', 'Covert Operations', ['Covert teams move covertly; covert work is quiet.']),
    ])
    const ids = index.search('cover').map((r) => r.doc.id)
    expect(ids.indexOf('status')).toBeLessThan(ids.indexOf('covert'))
  })

  it('picks the matching line as the snippet and marks the words', async () => {
    const index = await build()
    const stems = index.matchStems('cover ')
    expect(snippet(docs[3].lines, stems)).toBe('Take Cover: get behind something solid.')
    expect(highlight('Take Cover: now', stems)).toEqual([
      { text: 'Take ', hit: false },
      { text: 'Cover', hit: true },
      { text: ': now', hit: false },
    ])
  })

  it('filters by kind', async () => {
    const index = await SearchIndex.build([...docs, doc('rule', 'Cover', ['Summary.'], 'rule')])
    expect(index.search('cover ', (d) => d.kind === 'rule').map((r) => r.doc.id)).toEqual(['rule'])
  })
})
