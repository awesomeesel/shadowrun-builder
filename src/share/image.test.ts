import { describe, expect, it } from 'vitest'
import { pictureUrl } from './image'

describe('picture addresses in dropped data', () => {
  it('prefers the <img> of a dragged picture over the page it links to', () => {
    expect(
      pictureUrl({
        uriList: 'https://example.com/page',
        html: '<a href="https://example.com/page"><img src="https://cdn.example.com/map.jpg?w=1&amp;h=2"></a>',
      }),
    ).toBe('https://cdn.example.com/map.jpg?w=1&h=2')
  })

  it('reads a link list, skipping comments, or a pasted address', () => {
    expect(pictureUrl({ uriList: '# comment\nhttps://example.com/a.png' })).toBe('https://example.com/a.png')
    expect(pictureUrl({ text: '  https://example.com/b.webp ' })).toBe('https://example.com/b.webp')
  })

  it('ignores text that is not an address', () => {
    expect(pictureUrl({ text: 'Skybar, 7th floor' })).toBeNull()
    expect(pictureUrl({})).toBeNull()
  })
})
