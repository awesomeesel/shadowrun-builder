import { describe, expect, it } from 'vitest'
import { AdeptPowerSchema, createCharacter, type Character } from '../../model/character'
import { buy, raiseAttribute, raiseGrade, whyNot } from './advancement'
import { computeDerived } from './derived'
import { availableAbilities, gradeEffects, upgradeableAttributes } from './initiation'

function mage(overrides: Partial<Character> = {}): Character {
  return createCharacter({
    attributes: { ...createCharacter().attributes, magic: 6, willpower: 4, logic: 4 },
    karma: { available: 100, career: 100 },
    ...overrides,
  })
}

describe('initiation (pp. 166–167)', () => {
  it('costs 10 + the new grade and teaches a metamagic', () => {
    const p = raiseGrade(mage(), 'initiation', 'Centering')
    expect(p.cost).toBe(11)
    const initiated = buy(mage(), p)
    expect(initiated).toMatchObject({ initiateGrade: 1, metamagics: ['Centering'], karma: { available: 89 } })
    expect(raiseGrade(initiated, 'initiation', 'Masking').cost).toBe(12)
  })

  it("can't go above Magic, and needs a metamagic", () => {
    const low = mage({ attributes: { ...mage().attributes, magic: 1 }, initiateGrade: 1 })
    expect(whyNot(low, raiseGrade(low, 'initiation', 'Masking'))).toMatch(/can't go above your Magic \(1\)/)
    expect(whyNot(mage(), raiseGrade(mage(), 'initiation', ''))).toMatch(/Pick a metamagic/)
  })

  it('raises the Magic limit to 6 + grade', () => {
    expect(whyNot(mage(), raiseAttribute(mage(), 'magic'))).toMatch(/maximum \(6\)/)
    const initiated = mage({ initiateGrade: 1 })
    expect(whyNot(initiated, raiseAttribute(initiated, 'magic'))).toBeUndefined()
  })

  it('gives Centering dice and Power Points', () => {
    const c = mage({ initiateGrade: 2, metamagics: ['Centering', 'Power Point'] })
    expect(gradeEffects(c)).toMatchObject({ centeringDice: 2, extraPowerPoints: 1 })
    const adept = { ...c, adeptPowers: [AdeptPowerSchema.parse({ name: 'Test', powerPoints: 1 })] }
    expect(computeDerived(adept).magic?.powerPoints.available).toBe(7)
  })

  it('lists only metamagics that can still be taken', () => {
    const names = availableAbilities('metamagic', ['Centering'], false).map((a) => a.name)
    expect(names).not.toContain('Centering')
    expect(names).not.toContain('Power Point')
    expect(availableAbilities('metamagic', ['Power Point'], true).map((a) => a.name)).toContain('Power Point')
  })
})

describe('submersion (p. 195)', () => {
  const techno = (echoes: string[] = []) =>
    createCharacter({
      attributes: { ...createCharacter().attributes, resonance: 5, charisma: 3, logic: 4 },
      submersionGrade: echoes.length,
      echoes,
    })

  it('upgrades the living persona and allows each attribute twice', () => {
    const c = techno(['Matrix Attribute Upgrade: Firewall', 'Matrix Attribute Upgrade: Firewall'])
    expect(computeDerived(c).matrix?.firewall).toBe(c.attributes.willpower + 2)
    expect(upgradeableAttributes(c.echoes)).toEqual(['Attack', 'Sleaze', 'Data Processing'])
  })

  it('adds a hot-sim initiative die with Overclocking', () => {
    expect(computeDerived(techno(['Overclocking'])).matrix?.hotSimInitiative.dice).toBe(4)
  })

  it('raises the Resonance limit to 6 + grade', () => {
    const high = createCharacter({
      attributes: { ...createCharacter().attributes, resonance: 6 },
      karma: { available: 50, career: 50 },
    })
    expect(whyNot(high, raiseAttribute(high, 'resonance'))).toMatch(/maximum \(6\)/)
    const submerged = { ...high, submersionGrade: 1 }
    expect(whyNot(submerged, raiseAttribute(submerged, 'resonance'))).toBeUndefined()
  })
})
