/**
 * Common runner roles and starting suggestions for the build wizard. These are
 * play advice, not rules: every suggestion can be ignored or changed.
 */
import type { EntryKind } from '../../books/extract'
import type { AttributeId } from './attributes'
import type { MagicTypeId, PriorityCategory, PriorityLevel } from './creation'
import type { MetatypeId } from './metatypes'
import type { TraditionId } from './special'

export interface Suggestion {
  /** Search text for the book catalog. */
  query: string
  kinds: EntryKind[]
}

export interface RoleDef {
  id: string
  name: string
  blurb: string
  priorities: Record<PriorityCategory, PriorityLevel>
  magicType: MagicTypeId
  tradition?: TraditionId
  metatypes: MetatypeId[]
  keyAttributes: AttributeId[]
  keySkills: string[]
  /** One-line advice shown on each step for this role. */
  advice: Partial<Record<'priorities' | 'attributes' | 'skills' | 'qualities' | 'magic' | 'gear' | 'contacts', string>>
  qualities: Suggestion[]
  magic: Suggestion[]
  gear: Suggestion[]
  contacts: string[]
}

const q = (query: string, ...kinds: EntryKind[]): Suggestion => ({ query, kinds })

export const ROLES: RoleDef[] = [
  {
    id: 'samurai',
    name: 'Street samurai',
    blurb: 'Chromed-up muscle. Guns, blades and reflexes faster than anyone in the room.',
    priorities: { attributes: 'A', resources: 'B', skills: 'C', metatype: 'D', magic: 'E' },
    magicType: 'mundane',
    metatypes: ['ork', 'troll', 'human'],
    keyAttributes: ['body', 'agility', 'reaction', 'strength'],
    keySkills: ['firearms', 'close-combat', 'athletics', 'perception'],
    advice: {
      priorities: 'Attributes and Resources first: you need a strong body and money for cyberware.',
      attributes: 'Agility hits things, Reaction dodges, Body soaks damage. Cyberware will raise them further.',
      skills: 'Max out Firearms or Close Combat and pick a specialization for your favourite weapon.',
      gear: 'Armor, a good pistol or rifle, and reflex or muscle augmentations. Watch your Essence.',
      contacts: 'An arms dealer and a street doc keep you alive.',
    },
    qualities: [q('Ambidextrous', 'quality'), q('Built Tough', 'quality'), q('Toughness', 'quality')],
    magic: [],
    gear: [
      q('Ares Predator', 'weapon'),
      q('armor jacket', 'armor'),
      q('wired reflexes', 'augmentation'),
      q('muscle toner', 'augmentation'),
      q('smartlink', 'augmentation', 'gear'),
      q('commlink', 'matrixDevice'),
    ],
    contacts: ['Fixer', 'Arms dealer', 'Street doc'],
  },
  {
    id: 'adept',
    name: 'Adept',
    blurb: 'Magic turned inward: superhuman speed, strength and senses without any chrome.',
    priorities: { attributes: 'A', magic: 'B', skills: 'C', metatype: 'D', resources: 'E' },
    magicType: 'adept',
    metatypes: ['human', 'elf', 'ork'],
    keyAttributes: ['agility', 'reaction', 'body', 'willpower', 'magic'],
    keySkills: ['close-combat', 'athletics', 'stealth', 'perception'],
    advice: {
      priorities: 'Magic gives your power points; Attributes make the powers count.',
      attributes: 'Spend adjustment points on Magic: every point of Magic is one more power point.',
      magic: 'Your power points equal your Magic. Reflexes and combat powers are the classic picks.',
      gear: 'Skip cyberware: every bit of lost Essence costs you Magic and power points.',
    },
    qualities: [q('Focused Concentration', 'quality'), q('Catlike', 'quality')],
    magic: [q('Improved Reflexes', 'adeptPower'), q('Killing Hands', 'adeptPower'), q('Critical Strike', 'adeptPower')],
    gear: [q('armor', 'armor'), q('katana', 'weapon'), q('commlink', 'matrixDevice')],
    contacts: ['Fixer', 'Martial arts teacher', 'Talismonger'],
  },
  {
    id: 'mage',
    name: 'Combat mage',
    blurb: 'Hermetic spellcaster who treats magic as a science, and fireballs as an answer.',
    priorities: { magic: 'A', attributes: 'B', skills: 'C', metatype: 'D', resources: 'E' },
    magicType: 'magician',
    tradition: 'hermetic',
    metatypes: ['human', 'elf'],
    keyAttributes: ['magic', 'willpower', 'logic', 'intuition'],
    keySkills: ['sorcery', 'conjuring', 'astral', 'perception'],
    advice: {
      priorities: 'Magic A gives the highest Magic rating; everything you cast rolls Sorcery + Magic.',
      attributes: 'Willpower and Logic resist drain for a hermetic mage. Put adjustment points into Magic.',
      skills: 'Sorcery is your core skill. Conjuring summons spirits; Astral lets you fight on the astral plane.',
      magic: 'Pick a few attack spells, a heal and something sneaky. Each spell costs karma.',
      gear: 'Avoid cyberware. Buy a commlink, armor clothing and maybe a power focus later.',
    },
    qualities: [q('Focused Concentration', 'quality'), q('Analytical Mind', 'quality')],
    magic: [
      q('Manabolt', 'spell'),
      q('Stunbolt', 'spell'),
      q('Heal', 'spell'),
      q('Invisibility', 'spell'),
      q('Detect', 'spell'),
    ],
    gear: [q('armor clothing', 'armor'), q('commlink', 'matrixDevice'), q('focus', 'gear')],
    contacts: ['Fixer', 'Talismonger', 'Corporate wage mage'],
  },
  {
    id: 'shaman',
    name: 'Street shaman',
    blurb: 'Draws magic from a mentor spirit and the world around them. Talks to spirits.',
    priorities: { magic: 'A', attributes: 'B', skills: 'C', metatype: 'D', resources: 'E' },
    magicType: 'magician',
    tradition: 'shamanic',
    metatypes: ['human', 'ork', 'elf'],
    keyAttributes: ['magic', 'willpower', 'charisma', 'intuition'],
    keySkills: ['sorcery', 'conjuring', 'influence', 'perception'],
    advice: {
      priorities: 'Magic A for a strong Magic rating; shamans lean on Charisma, so Attributes B is a good fit.',
      attributes: 'Willpower and Charisma resist drain for a shaman. Charisma also helps you talk your way through.',
      skills: 'Conjuring makes the most of a shaman. Influence fits your Charisma.',
      magic: 'Mix healing and protection with a couple of attack spells.',
    },
    qualities: [q('Mentor Spirit', 'quality'), q('Focused Concentration', 'quality')],
    magic: [q('Heal', 'spell'), q('Stunbolt', 'spell'), q('Physical Barrier', 'spell'), q('Detect Life', 'spell')],
    gear: [q('armor clothing', 'armor'), q('commlink', 'matrixDevice')],
    contacts: ['Fixer', 'Talismonger', 'Gang leader'],
  },
  {
    id: 'decker',
    name: 'Decker',
    blurb: 'Hacker with a cyberdeck. Doors, cameras, drones and secrets all open for you.',
    priorities: { resources: 'A', skills: 'B', attributes: 'C', metatype: 'D', magic: 'E' },
    magicType: 'mundane',
    metatypes: ['human', 'dwarf', 'elf'],
    keyAttributes: ['logic', 'intuition', 'willpower', 'agility'],
    keySkills: ['cracking', 'electronics', 'perception', 'firearms'],
    advice: {
      priorities: 'Resources A: a good cyberdeck is the most expensive thing you will ever buy.',
      attributes: 'Logic drives your hacking skills; Intuition adds to Matrix initiative.',
      skills: 'Cracking breaks in, Electronics does everything else in the Matrix.',
      gear: 'Cyberdeck first, then a datajack or cyberjack, armor, and a backup commlink.',
      contacts: 'A data broker and a fixer turn stolen data into money.',
    },
    qualities: [q('Analytical Mind', 'quality'), q('Codeslinger', 'quality')],
    magic: [],
    gear: [
      q('cyberdeck', 'matrixDevice'),
      q('datajack', 'augmentation'),
      q('cyberjack', 'gear', 'augmentation'),
      q('armor', 'armor'),
      q('Colt America', 'weapon'),
    ],
    contacts: ['Fixer', 'Data broker', 'Hardware dealer'],
  },
  {
    id: 'technomancer',
    name: 'Technomancer',
    blurb: 'Hacks the Matrix with their mind. No deck, just Resonance and complex forms.',
    priorities: { magic: 'A', skills: 'B', attributes: 'C', metatype: 'D', resources: 'E' },
    magicType: 'technomancer',
    metatypes: ['human', 'dwarf', 'elf'],
    keyAttributes: ['resonance', 'logic', 'willpower', 'charisma', 'intuition'],
    keySkills: ['tasking', 'electronics', 'cracking', 'perception'],
    advice: {
      priorities: 'Resonance comes from the Magic/Resonance priority, so put it high.',
      attributes:
        'Your living persona uses Resonance, Charisma, Intuition, Logic and Willpower. Logic and Willpower resist fading.',
      magic: 'Complex forms cost karma. Pick a few you will use every session.',
      gear: 'You need no cyberdeck. Augmentations lower your Resonance, so stay away from them.',
    },
    qualities: [q('Analytical Mind', 'quality'), q('Focused Concentration', 'quality')],
    magic: [
      q('Puppeteer', 'complexForm'),
      q('Resonance Spike', 'complexForm'),
      q('Cleaner', 'complexForm'),
      q('Editor', 'complexForm'),
    ],
    gear: [q('armor', 'armor'), q('commlink', 'matrixDevice')],
    contacts: ['Fixer', 'Data broker', 'Technomancer friend'],
  },
  {
    id: 'rigger',
    name: 'Rigger',
    blurb: 'Driver and drone pilot. Jacked into vehicles, never far from a getaway.',
    priorities: { resources: 'A', skills: 'B', attributes: 'C', metatype: 'D', magic: 'E' },
    magicType: 'mundane',
    metatypes: ['human', 'dwarf', 'ork'],
    keyAttributes: ['reaction', 'intuition', 'logic'],
    keySkills: ['piloting', 'engineering', 'electronics', 'firearms'],
    advice: {
      priorities: 'Resources A: vehicles, drones and a control rig add up fast.',
      attributes: 'Reaction drives Piloting; Logic and Intuition matter once you rig.',
      skills: 'Piloting is everything. Engineering repairs and modifies your toys.',
      gear: 'A control rig, an RCC, a van and a few drones.',
      contacts: 'A mechanic and a smuggler keep you on the road.',
    },
    qualities: [q('Gearhead', 'quality'), q('Analytical Mind', 'quality')],
    magic: [],
    gear: [
      q('control rig', 'augmentation'),
      q('rigger command console', 'matrixDevice'),
      q('drone', 'vehicle'),
      q('van', 'vehicle'),
      q('armor', 'armor'),
    ],
    contacts: ['Fixer', 'Mechanic', 'Smuggler'],
  },
  {
    id: 'face',
    name: 'Face',
    blurb: 'The talker. Negotiates the pay, cons the guards and knows everybody.',
    priorities: { skills: 'A', attributes: 'B', resources: 'C', metatype: 'D', magic: 'E' },
    magicType: 'mundane',
    metatypes: ['elf', 'human'],
    keyAttributes: ['charisma', 'intuition', 'willpower'],
    keySkills: ['influence', 'con', 'perception', 'stealth'],
    advice: {
      priorities: 'Skills A for a wide spread of social and sneaky skills.',
      attributes: 'Charisma is your weapon. Elves can push it higher than anyone.',
      skills: 'Influence and Con with specializations. Perception catches lies.',
      qualities: 'Social qualities make every talk roll easier.',
      contacts: 'Lots of contacts with good Connection. They are your real power.',
    },
    qualities: [q('First Impression', 'quality'), q('Blandness', 'quality')],
    magic: [],
    gear: [
      q('armor clothing', 'armor'),
      q('business clothes', 'armor'),
      q('commlink', 'matrixDevice'),
      q('hold-out', 'weapon'),
    ],
    contacts: ['Fixer', 'Corporate secretary', 'Club owner', 'Bartender'],
  },
  {
    id: 'infiltrator',
    name: 'Infiltrator',
    blurb: 'Gets in, gets the thing, gets out. Nobody ever knew they were there.',
    priorities: { attributes: 'A', skills: 'B', resources: 'C', metatype: 'D', magic: 'E' },
    magicType: 'mundane',
    metatypes: ['elf', 'human', 'dwarf'],
    keyAttributes: ['agility', 'intuition', 'reaction'],
    keySkills: ['stealth', 'athletics', 'perception', 'electronics'],
    advice: {
      attributes: 'Agility for Stealth and Athletics; Intuition for spotting trouble first.',
      skills: 'Stealth with a specialization, Athletics for climbing, Electronics for locks and alarms.',
      gear: 'Quiet weapons, a chameleon suit and tools for maglocks.',
    },
    qualities: [q('Catlike', 'quality'), q('Blandness', 'quality')],
    magic: [],
    gear: [q('chameleon suit', 'armor'), q('maglock', 'gear'), q('silenc', 'gear'), q('Walther', 'weapon')],
    contacts: ['Fixer', 'Security guard', 'Locksmith'],
  },
]

export const ROLES_BY_ID = new Map(ROLES.map((r) => [r.id, r]))
