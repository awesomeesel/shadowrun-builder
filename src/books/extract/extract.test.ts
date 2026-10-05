// Fixtures are invented items laid out like rulebook pages. Never paste real book text here.
import { describe, expect, it } from 'vitest'
import type { PageLayout, PdfItem } from '../layout'
import { extractBook } from './index'

/** Build a fragment whose width is roughly proportional to its length. */
function t(x: number, y: number, s: string, h = 11): PdfItem {
  return [x, y, h, s, s.length * 5]
}

const page = (items: PdfItem[]): PageLayout => ({ width: 612, items })

describe('table extraction', () => {
  const weapons = page([
    t(63, 706, 'zap guns'),
    t(83, 695, 'WEAPON'),
    t(155, 695, 'DV'),
    t(213, 695, 'MODES'),
    t(262, 695, 'ATTACK RATINGS'),
    t(342, 695, 'AMMO'),
    t(396, 695, 'AVAILABILITY'),
    t(473, 695, 'COST'),
    t(72, 686, 'Testco Zapper'),
    t(156, 686, '3P'),
    t(220, 686, 'SA'),
    t(272, 686, '10/8/6/—/—'),
    t(347, 686, '12(c)'),
    t(415, 686, '2(L)'),
    t(474, 686, '450¥'),
    // A name that wraps above and below its data row.
    t(74, 678, 'Imaginary Arms'),
    t(156, 674, '4P'),
    t(215, 674, 'SA/BF'),
    t(272, 674, '9/9/7/—/—'),
    t(345, 674, '20(c)'),
    t(411, 674, '3(L)'),
    t(473, 674, '1,250¥'),
    t(91, 669, '600'),
    t(580, 672, '253'), // page number in the margin
  ])

  it('reads rows, wrapped names and the section label', () => {
    const entries = extractBook([weapons])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      kind: 'weapon',
      name: 'Testco Zapper',
      category: 'Zap guns',
      damage: '3P',
      modes: 'SA',
      attackRatings: [10, 8, 6, null, null],
      ammo: '12(c)',
      availability: '2(L)',
      cost: { base: 450, perRating: false },
    })
    expect(entries[1]).toMatchObject({ name: 'Imaginary Arms 600', cost: { base: 1250 } })
  })

  it('recognises augmentation tables with rated costs', () => {
    const ware = page([
      t(68, 695, 'BODYWARE'),
      t(186, 695, 'RATING'),
      t(275, 695, 'ESSENCE'),
      t(357, 695, 'AVAILABILITY'),
      t(460, 695, 'COST'),
      t(67, 686, 'Fake gland'),
      t(194, 686, '1–3'),
      t(270, 686, 'Rating x 0.25'),
      t(373, 686, '4(L)'),
      t(444, 686, 'Rating x 9,000¥'),
    ])
    expect(extractBook([ware])[0]).toMatchObject({
      kind: 'augmentation',
      name: 'Fake gland',
      rating: { min: 1, max: 3 },
      essence: { base: 0.25, perRating: true },
      cost: { base: 9000, perRating: true },
    })
  })
})

describe('text extraction', () => {
  const qualities = page([
    t(54, 700, 'Lucky Socks', 13),
    t(68, 685, 'You wear the same socks to every run.'),
    t(68, 670, '•'),
    t(81, 670, 'Cost:'),
    t(108, 670, '5 Karma per level'),
    t(68, 655, '•'),
    t(81, 655, 'Game Effect:'),
    t(146, 655, 'Nothing measurable.'),
    // Right column: a negative quality.
    t(295, 700, 'Loud Breather (1 to 3)', 13),
    t(308, 685, '•'),
    t(322, 685, 'Bonus:'),
    t(356, 685, '4 Karma per level'),
    t(308, 670, '•'),
    t(322, 670, 'Game Effect:'),
    t(380, 670, 'Everyone hears you.'),
  ])

  it('reads qualities in column order', () => {
    expect(extractBook([qualities])).toMatchObject([
      { kind: 'quality', name: 'Lucky Socks', positive: true, karma: 5, perLevel: true },
      { kind: 'quality', name: 'Loud Breather', positive: false, karma: 4, maxLevel: 3 },
    ])
  })

  it('reads adept powers, spells and complex forms', () => {
    const magic = page([
      t(54, 700, 'Sneaky Feet', 13),
      t(68, 685, 'Cost:'),
      t(95, 685, '0.5 PP per level'),
      t(68, 672, 'Activation:'),
      t(120, 672, 'Passive'),
      t(54, 600, 'Test Spells', 15),
      t(54, 580, 'Glowbolt', 13),
      t(54, 568, '(Direct Combat)'),
      t(66, 556, 'RANGE'),
      t(114, 556, 'TYPE'),
      t(151, 556, 'DURATION'),
      t(209, 556, 'DV'),
      t(245, 556, 'DAMAGE'),
      t(71, 546, 'LOS'),
      t(120, 546, 'M'),
      t(167, 546, 'I'),
      t(211, 546, '4'),
      t(245, 546, 'P'),
      t(295, 700, 'Static Hum', 13),
      t(309, 688, 'FADE VALUE'),
      t(387, 688, 'DURATION'),
      t(326, 678, '3'),
      t(402, 678, 'S'),
    ])
    expect(extractBook([magic])).toMatchObject([
      { kind: 'adeptPower', name: 'Sneaky Feet', powerPoints: 0.5, perLevel: true, activation: 'Passive' },
      { kind: 'spell', name: 'Glowbolt', spellCategory: 'combat', range: 'LOS', type: 'M', duration: 'I', drain: '4' },
      { kind: 'complexForm', name: 'Static Hum', fading: '3', duration: 'S' },
    ])
  })
})

describe('duplicates', () => {
  it('keeps one copy of a table the book prints twice', () => {
    const table = (y: number): PdfItem[] => [
      t(68, y, 'ITEM'),
      t(150, y, 'DEVICE RATING'),
      t(260, y, 'ATTRIBUTES (D/F)'),
      t(380, y, 'AVAIL'),
      t(460, y, 'COST'),
      t(68, y - 10, 'Testlink'),
      t(170, y - 10, '2'),
      t(280, y - 10, '1/1'),
      t(390, y - 10, '2'),
      t(460, y - 10, '500¥'),
    ]
    const entries = extractBook([page(table(700)), page(table(400))])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ kind: 'matrixDevice', page: 1, deviceRating: 2, attributes: '1/1' })
  })
})
