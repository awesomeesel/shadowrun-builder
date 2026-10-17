/**
 * Quick rules reference for the table, written as short summaries in our own
 * words with Core Rulebook page numbers for the full rule.
 */
import { EDGE_BOOSTS } from './play'
import { STATUSES } from './statuses'

export interface RuleEntry {
  title: string
  /** One or a few short lines. */
  lines: string[]
  page: number
}

export interface RuleSection {
  id: string
  title: string
  entries: RuleEntry[]
}

export const RULES_REFERENCE: RuleSection[] = [
  {
    id: 'rounds',
    title: 'Combat rounds & initiative',
    entries: [
      {
        title: 'Initiative',
        lines: [
          'Everyone rolls Initiative dice once when the fight starts and adds their Initiative Score.',
          'Highest acts first. It is not rerolled each round; statuses like Dazed or Chilled lower it while they last.',
          'Ties: higher Edge goes first, then Reaction, then Intuition, then a coin flip.',
        ],
        page: 106,
      },
      {
        title: 'Combat round',
        lines: [
          'About 3 seconds. Everyone gets one player turn per round, in initiative order.',
          'After the last turn, the round ends: status damage (Burning, Corrosive, Poisoned) is resisted, then a new round starts at the top.',
        ],
        page: 107,
      },
      {
        title: 'Actions per round',
        lines: [
          '1 Major and 1 Minor action, plus 1 Minor per Initiative die (at most 5 Minor).',
          'A Major can be used as a Minor; 4 Minor make 1 Major.',
          'Actions marked (A) can be used outside your turn, if you saved one. Unused actions don’t carry over.',
        ],
        page: 40,
      },
      {
        title: 'Surprise',
        lines: [
          'When an ambush starts, the GM can call for a Reaction + Intuition test; failing means no actions in the first round.',
        ],
        page: 108,
      },
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    entries: [
      {
        title: 'Minor actions',
        lines: [
          'Avoid Incoming (A): Reaction + Athletics to dodge a blast; move a meter per hit.',
          'Block (A) / Dodge (A): add Close Combat (melee) or Athletics to one Defense test.',
          'Call a Shot: −4 dice for +2 damage (with Attack).',
          'Change Device Mode (A), Command Drone, Command Spirit, Drop Object (A).',
          'Drop Prone / Hit the Dirt (A): Prone; Hit the Dirt gives +2 on that defense but −2 on skills until you stand.',
          'Intercept (A): melee attack out of turn when a foe comes close (uses your Major too).',
          'Move: 10 meters, once per turn. Multiple Attacks: split the pool (with Attack).',
          'Quick Draw: draw and attack with a pistol-sized weapon (needs the right gear).',
          'Reload Smartgun, Shift Perception, Stand Up, Take Aim (+1 die, up to Willpower, carries over), Take Cover, Trip.',
        ],
        page: 40,
      },
      {
        title: 'Major actions',
        lines: [
          'Attack, Cast Spell, Summon Spirit, Banish Spirit, Use Skill, Use Simple Device.',
          'Full Defense (A): + Willpower to all Defense tests until your next round.',
          'Counterspell (A), Astral Projection, Manifest, Cleanse, Assist (A, teamwork).',
          'Observe in Detail: a Perception test during combat.',
          'Ready Weapon, Pick Up/Put Down Object, Reload Weapon (without a smartgun link).',
          'Rigger Jump In. Sprint: 15 m + 1 m per hit on Athletics + Agility (not with Move).',
        ],
        page: 42,
      },
    ],
  },
  {
    id: 'attacking',
    title: 'Attacking',
    entries: [
      {
        title: 'Five steps',
        lines: [
          '1. Grab dice: attacker’s skill + attribute; defender’s Reaction + Intuition.',
          '2. Edge: compare Attack Rating with Defense Rating; 4 or more higher gives that side 1 Edge.',
          '3. Roll and spend Edge. Net hits of the attacker add to the damage.',
          '4. Soak: damage = DV + net hits; the target rolls Body and each hit takes off a box.',
          '5. Apply what’s left to the Physical or Stun track.',
        ],
        page: 106,
      },
      {
        title: 'Firing modes',
        lines: [
          'Single shot: 1 round. Semi-auto: 2 rounds, AR −2, DV +1.',
          'Burst: 4 rounds, AR −4, DV +2 (or a wide burst at two targets).',
          'Full auto: 10 rounds, AR −6, split the pool over targets in range.',
        ],
        page: 109,
      },
      {
        title: 'Cover',
        lines: [
          'Cover I–IV: +1 Defense Rating and defense dice per level. Firing from cover costs a Minor; at IV the attack is −2.',
        ],
        page: 52,
      },
      {
        title: 'Unarmed',
        lines: [
          'Attack Rating Reaction + Strength. Damage (Strength ÷ 2, rounded up) Stun, unless something makes it Physical.',
        ],
        page: 39,
      },
    ],
  },
  {
    id: 'edge',
    title: 'Edge',
    entries: [
      {
        title: 'Gaining Edge',
        lines: [
          'From Attack Rating vs Defense Rating (4+ difference), and from advantages the GM sees in the situation.',
          'At most 2 Edge gained per combat round, and never more than 7 in total.',
        ],
        page: 44,
      },
      {
        title: 'Edge boosts',
        lines: [
          ...Object.values(EDGE_BOOSTS).map((b) => `${b.label}: ${b.cost} Edge.`),
          '+3 Initiative Score: 1 Edge. Give an ally 1 Edge or take 1 from a foe: 2 Edge.',
          'Heal a Stun box: 3 Edge. Heal a Physical box: 4 Edge.',
          'Add your Edge rating as dice, 6s explode: 4 Edge (before rolling).',
          'Count 2s as glitches for a target: 5 Edge.',
        ],
        page: 46,
      },
      {
        title: 'Burning Edge',
        lines: [
          'Lose a point of Edge rating for good: Smackdown (automatic success with 4 net hits) or Not Dead Yet (survive certain death).',
        ],
        page: 48,
      },
    ],
  },
  {
    id: 'damage',
    title: 'Damage & healing',
    entries: [
      {
        title: 'Condition monitors',
        lines: [
          'Physical: 8 + Body ÷ 2 (round up). Stun: 8 + Willpower ÷ 2.',
          '−1 to all tests (except damage resistance) per full row of 3 boxes.',
          'Full Stun: unconscious, and further Stun becomes Physical. Full Physical: dying; extra goes to Overflow (Body × 2 kills).',
        ],
        page: 38,
      },
      {
        title: 'Grunts',
        lines: [
          'One track: 8 + half of Body or Willpower, whichever is higher (lieutenants add their Professional Rating).',
          '−1 per 2 boxes. Last hit Physical: dying; last hit Stun: unconscious.',
          'The group shares an Edge pool equal to its Professional Rating, usable once per round.',
          'Once boxes taken exceed the Professional Rating, a Composure test decides whether they flee.',
        ],
        page: 203,
      },
      {
        title: 'Healing',
        lines: [
          'First aid (within a minute) and medkit (within an hour): Biotech + Logic vs 5 − Essence.',
          'Healing spells: Sorcery + Magic vs 5 − Essence. Each method once per set of injuries; none heal drain.',
          'Rest: Body + Willpower per hour (Stun), Body + Body per day (Physical).',
        ],
        page: 119,
      },
    ],
  },
  {
    id: 'magic',
    title: 'Magic & Matrix',
    entries: [
      {
        title: 'Spellcasting',
        lines: [
          'Sorcery + Magic. Amp Up: +1 damage for +2 drain. Bigger area: +2 m radius for +1 drain.',
          'Drain: Willpower + tradition attribute against the Drain Value; Physical if more than Magic.',
          'Each sustained spell: −2 dice on action tests.',
        ],
        page: 131,
      },
      {
        title: 'Spirits',
        lines: [
          'Summon: Conjuring + Magic vs Force × 2; net hits are services. Drain = the spirit’s hits.',
          'Banish: same test; net hits remove services; drain = twice the spirit’s hits.',
          'Total Force of active spirits ≤ Magic × 3.',
        ],
        page: 146,
      },
      {
        title: 'Matrix initiative',
        lines: [
          'AR: Reaction + Intuition + 1D6. Cold-sim VR: Intuition + Data Processing + 2D6. Hot-sim: + 3D6.',
          'Overwatch Score builds with illegal actions; at 40, Convergence.',
        ],
        page: 179,
      },
    ],
  },
  {
    id: 'statuses',
    title: 'Statuses',
    entries: STATUSES.map((s) => ({
      title: s.value === 'level' ? `${s.name} I–III` : s.value === 'number' ? `${s.name} #` : s.name,
      lines: [s.effect],
      page: s.page,
    })),
  },
]
