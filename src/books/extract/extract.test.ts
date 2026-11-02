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

describe('Matrix device tables', () => {
  it('joins a header split over two lines and reads program slots', () => {
    const entries = extractBook([
      page([
        t(298, 705, 'ACTIVE PROGRAM'),
        t(94, 700, 'ITEM'),
        t(152, 700, 'DEVICE RATING'),
        t(222, 700, 'ATTRIBUTES (A/S)'),
        t(392, 700, 'AVAIL'),
        t(468, 700, 'COST'),
        t(316, 695, 'SLOTS'),
        t(88, 685, 'Testdeck'),
        t(174, 685, '4'),
        t(246, 685, '7/6'),
        t(324, 685, '8'),
        t(396, 685, '4(I)'),
        t(464, 685, '107,000¥'),
      ]),
    ])
    expect(entries[0]).toMatchObject({ kind: 'matrixDevice', deviceRating: 4, attributes: '7/6', programSlots: 8 })
  })

  it('treats accessories without Matrix attributes as gear', () => {
    const entries = extractBook([
      page([
        t(68, 700, 'ITEM'),
        t(150, 700, 'DEVICE RATING'),
        t(380, 700, 'AVAIL'),
        t(460, 700, 'COST'),
        t(68, 690, 'Test gloves'),
        t(170, 690, '3'),
        t(390, 690, '1'),
        t(460, 690, '150¥'),
      ]),
    ])
    expect(entries[0]).toMatchObject({ kind: 'gear', name: 'Test gloves' })
  })
})

describe('books laid out differently', () => {
  it('ignores text the PDF draws twice', () => {
    const items = [
      t(54, 700, 'Lucky Socks', 13),
      t(68, 685, 'Cost:'),
      t(95, 685, '5 Karma'),
      t(68, 670, 'Game Effect:'),
      t(133, 670, 'Nothing measurable.'),
    ]
    // Every fragment twice, the copies a fraction of a point apart.
    const doubled = items.flatMap((i): PdfItem[] => [i, [i[0] + 0.3, i[1] - 0.2, i[2], i[3], i[4]]])
    expect(extractBook([page(doubled)])).toMatchObject([{ kind: 'quality', name: 'Lucky Socks', karma: 5 }])
  })

  it('joins a heading wrapped onto a second line', () => {
    const wrapped = page([
      t(54, 700, 'Remarkably Lucky Pair of Odd', 13),
      t(54, 687, 'Socks (pick a color)', 13),
      t(68, 672, 'Cost:'),
      t(95, 672, '5 Karma'),
      t(68, 658, 'Game Effect:'),
      t(133, 658, 'Nothing measurable, though you feel better about it.'),
      t(68, 644, 'Wear them to every run and never wash them, ever.'),
      t(295, 700, 'Supercalifragilistic Sock Bal-', 13),
      t(295, 687, 'ance', 13),
      t(309, 672, 'Bonus:'),
      t(340, 672, '3 Karma'),
      t(309, 658, 'Game Effect:'),
      t(374, 658, 'You trip over your own feet when it matters most.'),
      t(309, 644, 'Everyone saw it, and everyone will remember it.'),
    ])
    expect(extractBook([wrapped]).map((e) => e.name)).toEqual([
      'Remarkably Lucky Pair of Odd Socks (pick a color)',
      'Supercalifragilistic Sock Balance',
    ])
  })

  it('takes the spell category from a bare section heading', () => {
    const health = page([
      t(54, 720, 'Health', 21),
      t(54, 700, 'Sniffle Cure', 13),
      t(66, 688, 'RANGE', 7),
      t(114, 688, 'TYPE', 7),
      t(151, 688, 'DURATION', 7),
      t(209, 688, 'DV', 7),
      t(71, 678, 'T'),
      t(120, 678, 'M'),
      t(167, 678, 'P'),
      t(211, 678, '3'),
      t(68, 660, 'Clears a stuffy nose.'),
    ])
    expect(extractBook([health])).toMatchObject([{ kind: 'spell', name: 'Sniffle Cure', spellCategory: 'health' }])
  })

  it('reads a single vehicle’s stat block beside a column of text', () => {
    // Labels are small type, about 3.6 points a letter.
    const label = (x: number, y: number, s: string): PdfItem => [x, y, 7, s, s.length * 3.6]
    const prose = (y: number) => t(54, y, 'Words in the other column, running on and on.')
    // As in the books: the stacked labels and the header share their lines with the other column's text.
    const garage = page([
      prose(720),
      t(304, 716, 'Testco Roadhog 3000'),
      prose(708),
      t(304, 704, '(imaginary racing bike)'),
      prose(691),
      label(345, 691, 'SPD'),
      label(364, 691, 'TOP'),
      label(306, 687, 'HAND ACCEL'),
      label(382, 687, 'BOD ARM'),
      label(417, 687, 'PILOT'),
      label(437, 687, 'SENS'),
      label(456, 687, 'SEAT'),
      label(473, 687, 'AVAIL'),
      label(495, 687, 'COST'),
      label(346, 684, 'INT'),
      label(364, 684, 'SPD'),
      prose(679),
      t(309, 675, '3/4'),
      t(329, 675, '12'),
      t(348, 675, '20'),
      t(366, 675, '150'),
      t(386, 675, '6'),
      t(405, 675, '4'),
      t(423, 675, '2'),
      t(442, 675, '1'),
      t(460, 675, '2'),
      t(479, 675, '3'),
      t(493, 675, '9,000¥'),
      prose(668),
    ])
    expect(extractBook([garage])).toMatchObject([
      {
        kind: 'vehicle',
        name: 'Testco Roadhog 3000',
        category: 'Imaginary racing bike',
        drone: false,
        handling: '3/4',
        acceleration: '12',
        speedInterval: '20',
        topSpeed: '150',
        body: 6,
        armor: 4,
        pilot: 2,
        sensor: 1,
        seats: '2',
        availability: '3',
        cost: { base: 9000 },
      },
    ])
  })
})
