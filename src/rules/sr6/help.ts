/**
 * Short explanations for players new to the Sixth World, in our own words,
 * with Core Rulebook page numbers for the full rule. Shown behind the small
 * help buttons on the Play tab.
 */

export interface HelpEntry {
  title: string
  text: string
  /** Core Rulebook page. */
  page?: number
}

/** What each skill is for and when you'd roll it. */
export const SKILL_HELP: Record<string, HelpEntry> = {
  astral: {
    title: 'Astral',
    text: 'Fighting and getting around on the astral plane, and reading auras when you look at someone astrally. Awakened only.',
    page: 93,
  },
  athletics: {
    title: 'Athletics',
    text: 'Running, sprinting, climbing, jumping, swimming and throwing (grenades, knives). Also used to dodge out of the way of a blast.',
    page: 93,
  },
  biotech: {
    title: 'Biotech',
    text: 'First aid, medkits and patching people up, plus cyberware and medical know-how. The healing roll after a fight uses this.',
    page: 94,
  },
  'close-combat': {
    title: 'Close Combat',
    text: 'Fists, blades, clubs and anything else up close. Your attack roll in melee. A matching specialization (Blades, Unarmed…) adds 2 dice.',
    page: 94,
  },
  con: {
    title: 'Con',
    text: 'Lying, disguises, pretending to be someone you aren’t, and fast-talking your way past a guard.',
    page: 94,
  },
  conjuring: {
    title: 'Conjuring',
    text: 'Summoning, banishing and binding spirits. Awakened only.',
    page: 94,
  },
  cracking: {
    title: 'Cracking',
    text: 'Illegal Matrix work: breaking into devices and hosts, hacking on the fly, fighting other deckers and IC.',
    page: 94,
  },
  electronics: {
    title: 'Electronics',
    text: 'Legal Matrix work and hardware: searching the Matrix, editing files, using and repairing devices.',
    page: 95,
  },
  enchanting: {
    title: 'Enchanting',
    text: 'Making foci and other magical items, and handling reagents. Awakened only.',
    page: 95,
  },
  engineering: {
    title: 'Engineering',
    text: 'Building and repairing machines, vehicles, weapons and drones; picking locks; demolitions.',
    page: 95,
  },
  'exotic-weapons': {
    title: 'Exotic Weapons',
    text: 'Unusual weapons that each need their own training, like a monowhip or a launcher. Can’t be used untrained.',
    page: 95,
  },
  firearms: {
    title: 'Firearms',
    text: 'Pistols, SMGs, rifles, shotguns and machine guns. Your attack roll for every gun. A matching specialization (Pistols, Rifles…) adds 2 dice.',
    page: 95,
  },
  influence: {
    title: 'Influence',
    text: 'Getting people to do what you want honestly: negotiating, leading, intimidating, and handling etiquette.',
    page: 96,
  },
  outdoors: {
    title: 'Outdoors',
    text: 'Surviving in the wild: tracking, navigation, finding food and shelter.',
    page: 96,
  },
  perception: {
    title: 'Perception',
    text: 'Noticing things: an ambush, a hidden gun, someone tailing you. The GM often asks for this one, sometimes in secret.',
    page: 97,
  },
  piloting: {
    title: 'Piloting',
    text: 'Driving and flying anything, from a bike in a chase to a drone you’re steering.',
    page: 97,
  },
  sorcery: {
    title: 'Sorcery',
    text: 'Casting spells, ritual magic and countering other mages’ spells. Awakened only.',
    page: 97,
  },
  stealth: {
    title: 'Stealth',
    text: 'Sneaking, hiding, palming small items and staying unseen. Usually rolled against someone else’s Perception.',
    page: 97,
  },
  tasking: {
    title: 'Tasking',
    text: 'Compiling and registering sprites, and using complex forms. Technomancers only.',
    page: 97,
  },
}

/** The other things on the Play tab. */
export const PLAY_HELP: Record<string, HelpEntry> = {
  howToRoll: {
    title: 'How a test works',
    text: 'Roll as many six-sided dice as the pool says. Every 5 or 6 is a hit. The GM tells you how many hits you need (the threshold), or you compare hits with an opponent. If more than half your dice show 1, it’s a glitch: something goes wrong. A glitch with no hits at all is a critical glitch.',
    page: 44,
  },
  initiative: {
    title: 'Initiative',
    text: 'Decides who acts first in a fight. Roll the dice and add the number in front: the total is your place in the order. Higher goes first.',
    page: 106,
  },
  defenseRating: {
    title: 'Defense Rating',
    text: 'How hard you are to hit: Body plus armor. When someone attacks you, their Attack Rating is compared with this. If one is 4 or more higher, that side gets 1 Edge.',
    page: 108,
  },
  wounds: {
    title: 'Wound modifier',
    text: 'Injuries make everything harder: −1 die for every 3 filled boxes on each damage track. The app takes it off your pools for you (but not when you soak damage).',
    page: 38,
  },
  physical: {
    title: 'Physical damage',
    text: 'Real injuries: bullets, blades, falling. When the track is full you’re dying; extra damage goes to Overflow, and when that fills up too, your runner dies.',
    page: 38,
  },
  stun: {
    title: 'Stun damage',
    text: 'Bruises, shocks and exhaustion. When the track is full you’re knocked out; any more Stun damage turns into Physical damage.',
    page: 38,
  },
  edge: {
    title: 'Edge',
    text: 'Your luck and nerve, in points. You start a session with your Edge rating and gain more (at most 2 per round, never above 7) when the situation favors you. Spend it on boosts after a roll, or on Edge actions before one.',
    page: 44,
  },
  defense: {
    title: 'Defense test',
    text: 'Reaction + Intuition. Roll this when someone attacks you; every hit cancels one of theirs.',
    page: 106,
  },
  damageResistance: {
    title: 'Damage resistance (soak)',
    text: 'Body. After an attack hits, roll this: every hit takes one box off the damage. Wound modifiers don’t apply.',
    page: 106,
  },
  composure: {
    title: 'Composure',
    text: 'Willpower + Charisma. Keeping your cool when things get scary or stressful. The GM calls for it.',
    page: 67,
  },
  judgeIntentions: {
    title: 'Judge Intentions',
    text: 'Willpower + Intuition. Reading someone: are they lying, nervous, about to draw a gun?',
    page: 67,
  },
  memory: {
    title: 'Memory',
    text: 'Logic + Intuition. Remembering a face, a name, a detail you saw earlier.',
    page: 67,
  },
  liftCarry: {
    title: 'Lift / Carry',
    text: 'Body + Willpower. Lifting or carrying something heavy, like a wounded teammate.',
    page: 67,
  },
  specialization: {
    title: 'Specialization',
    text: 'A narrower part of a skill you’re especially good at. When it applies (Blades for a katana, say), you get 2 extra dice.',
  },
}

export type EdgeActionTag = 'melee' | 'ranged' | 'any' | 'social' | 'defense'

export interface EdgeAction {
  name: string
  cost: number
  /** The action it goes with, as in the book's parentheses. */
  with: string
  tag: EdgeActionTag
  text: string
  page: number
}

/**
 * Edge actions (p. 47–48): spent together with an action, and chosen before
 * the dice are rolled. Never free; the cost is always at least 1.
 */
export const EDGE_ACTIONS: EdgeAction[] = [
  {
    name: 'Shank',
    cost: 1,
    with: 'Melee attack with a blade',
    tag: 'melee',
    text: 'Calling a shot with a blade costs only −2 dice instead of −4.',
    page: 48,
  },
  {
    name: 'Sudden Insight',
    cost: 1,
    with: 'Any action',
    tag: 'any',
    text: 'Use a skill you don’t have without the usual penalty. Doesn’t work for skills that can’t be used untrained.',
    page: 48,
  },
  {
    name: 'Tactical Roll',
    cost: 1,
    with: 'Hit the Dirt',
    tag: 'defense',
    text: 'Dive and still fight: no Prone or Hit the Dirt penalty on a melee attack this round, and no −2 against Close or Near attacks next round.',
    page: 48,
  },
  {
    name: 'Tumble',
    cost: 1,
    with: 'Melee attack',
    tag: 'melee',
    text: 'If the damage you deal is more than the target’s Body, they’re knocked down (Prone).',
    page: 48,
  },
  {
    name: 'Bring the Drama',
    cost: 2,
    with: 'Con test',
    tag: 'social',
    text: 'Lay it on thick. A quick con earns about 200¥ from onlookers; a long con lets you ask 20% more, and the mark agrees.',
    page: 47,
  },
  {
    name: 'Fire from Cover',
    cost: 2,
    with: 'Ranged attack, in Cover IV',
    tag: 'ranged',
    text: 'Shoot from full cover without spending the Minor Action it normally takes.',
    page: 47,
  },
  {
    name: 'Knockout Blow',
    cost: 2,
    with: 'Melee attack, after spending Edge on your previous action',
    tag: 'melee',
    text: 'If your damage is more than the target’s Willpower, they’re knocked out cold: Stun track filled, nothing spills into Physical.',
    page: 47,
  },
  {
    name: 'Wrest',
    cost: 2,
    with: 'Successful Block',
    tag: 'defense',
    text: 'Grab their weapon: Close Combat + Agility against their Strength. Equal: it drops. More hits: it’s yours.',
    page: 48,
  },
  {
    name: 'Anticipation',
    cost: 4,
    with: 'Multiple ranged attacks',
    tag: 'ranged',
    text: 'You herded them into place: roll your full pool against each target instead of splitting it.',
    page: 47,
  },
  {
    name: 'Big Speech',
    cost: 4,
    with: 'Influence test',
    tag: 'social',
    text: 'Roll Influence twice: the first roll’s hits add dice to the second, which counts.',
    page: 47,
  },
  {
    name: 'Called Shot—Disarm',
    cost: 5,
    with: 'Any attack',
    tag: 'any',
    text: 'If you hit, you do no damage but knock their weapon out of their hands.',
    page: 47,
  },
  {
    name: 'Called Shot—Vitals',
    cost: 5,
    with: 'Any attack',
    tag: 'any',
    text: 'If you hit, add 3 damage on top of your net hits.',
    page: 47,
  },
]

/** Other ways to spend Edge, besides the after-roll boosts the roll panel offers. */
export const OTHER_EDGE_USES: { name: string; cost: number; text: string; page: number }[] = [
  { name: '+3 Initiative Score', cost: 1, text: 'Move up the order, before the fight or for the next pass.', page: 46 },
  { name: 'Give an ally 1 Edge', cost: 2, text: 'Help a teammate: you lose 2, they gain 1.', page: 46 },
  { name: 'Take 1 Edge from a foe', cost: 2, text: 'You lose 2, an opponent you pick loses 1.', page: 46 },
  { name: 'Heal 1 Stun box', cost: 3, text: 'A second wind.', page: 47 },
  { name: 'Heal 1 Physical box', cost: 4, text: 'The hit wasn’t as bad as it looked.', page: 47 },
  {
    name: '2s count as glitches',
    cost: 5,
    text: 'On one opponent’s roll, 1s and 2s both count toward a glitch.',
    page: 47,
  },
  {
    name: 'Special effect',
    cost: 5,
    text: 'Something lucky happens: a burst pipe, sirens, a DocWagon crew. Agree it with the GM.',
    page: 47,
  },
]

/** Burning Edge (p. 48): lose a point of Edge rating for good, and all your Edge points. */
export const BURN_EDGE: { name: string; text: string }[] = [
  { name: 'Smackdown', text: 'Automatic success on the test you’re about to make, with 4 net hits.' },
  {
    name: 'Not Dead Yet',
    text: 'Survive something that would kill you. It doesn’t get you out of the situation by itself.',
  },
]
