// Screenshots for the manual, in fresh browser profiles (the user's own data is never touched).
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5173/'
const OUT = new URL('./shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const only = process.argv[2]

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function context(viewport, mobile = false) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: 'dark',
  })
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('whatsNewSeen', '999'); sessionStorage.setItem('splashSeen', '1')
    } catch {}
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('console', m.text().slice(0, 300)))
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  return { ctx, page }
}

const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash)
  await wait(900)
}
const shot = async (page, name, options = {}) => {
  await wait(400)
  await page.screenshot({ path: `${OUT}${name}.png`, ...options })
  console.log('shot', name)
}
/** Hide the "connect Google Drive" banner where it isn't the point of the picture. */
const hideBackupBanner = (page) =>
  page.addStyleTag({ content: 'div.mb-5.border-amber\\/50 { display: none !important }' })

// ---------- Player on a phone: three demo runners ----------
const player = await context({ width: 390, height: 844 }, true)
const ids = await player.page.evaluate(async () => {
  const { addCharacter } = await import('/src/db/characters.ts')
  const { quickMake } = await import('/src/rules/sr6/quickBuild.ts')
  const { ROLES_BY_ID } = await import('/src/rules/sr6/roles.ts')
  const make = (role, metatype, name) =>
    quickMake({ role: ROLES_BY_ID.get(role), metatype, name, random: () => 0.37 }).character
  const M = await import('/src/model/character.ts')
  const gear = (name, extra = {}) => M.GearSchema.parse({ name, ...extra })
  const weapon = (name, extra) => M.WeaponSchema.parse({ name, ...extra })

  const rook = make('samurai', 'ork', 'Rook')
  rook.playerName = 'Kari'
  rook.concept = 'Street samurai'
  rook.weapons = [
    weapon('Heavy pistol', { skillId: 'firearms', specialization: 'Pistols', damage: '3P', attackRatings: [10, 10, 8, null, null], modes: 'SA', ammo: '15(c)' }),
    weapon('Katana', { skillId: 'close-combat', specialization: 'Blades', damage: '4P', attackRatings: [9, null, null, null, null] }),
  ]
  rook.gear = [...rook.gear, gear('Armor jacket', { armor: 4, equipped: true })]
  rook.matrixDevices = [M.MatrixDeviceSchema.parse({ name: 'Commlink', kind: 'commlink', deviceRating: 3, dataProcessing: 3, firewall: 3, programSlots: 1, active: true })]

  const whisper = make('mage', 'elf', 'Whisper')
  whisper.playerName = 'Jonas'
  whisper.concept = 'Hermetic mage'
  const spell = (name, category, type, range, duration, drain) => M.SpellSchema.parse({ name, category, type, range, duration, drain })
  whisper.spells = [
    spell('Stunbolt', 'combat', 'mana', 'LOS', 'I', '3'),
    spell('Heal', 'health', 'mana', 'T', 'P', '4'),
    spell('Invisibility', 'illusion', 'mana', 'LOS', 'S', '3'),
  ]
  whisper.gear = [...whisper.gear, gear('Armored clothing', { armor: 2, equipped: true })]

  const glitch = make('decker', 'dwarf', 'Glitch')
  glitch.playerName = 'Mia'
  glitch.concept = 'Decker'

  const out = []
  for (const c of [rook, whisper, glitch]) out.push((await addCharacter(c)).id)
  return out
})
console.log('characters', ids)

if (!only || only === 'player') {
  // Character list
  await go(player.page, '#/')
  await shot(player.page, 'list-phone')
  // Sheet
  await go(player.page, `#/character/${ids[0]}`)
  await shot(player.page, 'sheet-phone')
  // Play: start a session and roll the pistol
  await go(player.page, `#/character/${ids[0]}/play`)
  await player.page.getByRole('button', { name: 'Start session' }).click()
  await wait(800)
  await shot(player.page, 'play-phone')
  const attack = player.page.locator('li', { hasText: 'Katana' }).getByRole('button', { name: 'Attack' }).first()
  await attack.scrollIntoViewIfNeeded()
  await player.page.mouse.wheel(0, 200)
  await attack.click()
  await wait(700)
  await shot(player.page, 'play-roll-phone')
}

// ---------- GM on a laptop ----------
const gm = await context({ width: 1280, height: 860 })

if (!only || only === 'gm' || only === 'player') {
  // Wizard (a new character in build mode)
  await go(gm.page, '#/')
  await gm.page.getByRole('button', { name: 'New character' }).first().click()
  await gm.page.waitForURL(/wizard/)
  await wait(1200)
  await shot(gm.page, 'wizard')
  const wizardUrl = gm.page.url()
  const wizardId = wizardUrl.split('/character/')[1]?.split('/')[0]
  await gm.page.evaluate(async (id) => {
    const { deleteCharacter } = await import('/src/db/characters.ts')
    if (id) await deleteCharacter(id)
  }, wizardId)
}

// Real campaign on the sharing server, closed again at the end.
const campaign = await gm.page.evaluate(async () => {
  const C = await import('/src/share/campaigns.ts')
  const c = await C.createCampaign('Seattle Nights', 'chummer')
  return { id: c.id, code: c.code, link: C.joinLink(c, true) }
})
console.log('campaign', campaign.code)

try {
  // GM home and the fresh campaign page with join info
  await go(gm.page, '#/gm')
  await shot(gm.page, 'gm-home-empty-campaign')
  await go(gm.page, `#/gm/campaign/${campaign.id}`)
  await shot(gm.page, 'campaign-join')

  // Player joins through the link (what the QR code opens)
  const hash = campaign.link.slice(campaign.link.indexOf('#'))
  await go(player.page, hash)
  await player.page.getByText('Found', { exact: false }).first().waitFor({ timeout: 30000 })
  await wait(500)
  for (const name of ['Rook', 'Whisper', 'Glitch']) {
    const box = player.page.getByLabel(name)
    if (!(await box.isChecked())) await box.check()
  }
  await shot(player.page, 'join-phone')
  await player.page.getByRole('button', { name: 'Join and share' }).click()
  await player.page.getByText('Joined', { exact: false }).first().waitFor({ timeout: 30000 })
  await shot(player.page, 'joined-phone')

  // Share dialog on a character
  await go(player.page, `#/character/${ids[1]}`)
  await player.page.getByTitle('Share this character with your GM').click()
  await wait(800)
  await shot(player.page, 'share-dialog-phone')
  await player.page.keyboard.press('Escape')

  // Rook takes some damage while the GM watches
  await player.page.evaluate(async (id) => {
    const { db } = await import('/src/db/db.ts')
    const { saveCharacter } = await import('/src/db/characters.ts')
    const c = await db.characters.get(id)
    await saveCharacter({ ...c, damage: { physical: 4, stun: 2, overflow: 0 } })
  }, ids[0])
  // Until the GM has all three runners, with Rook's damage.
  await gm.page.waitForFunction(
    async (roomId) => {
      const { db } = await import('/src/db/db.ts')
      const sheets = await db.sharedSheets.where('roomId').equals(roomId).toArray()
      return sheets.length === 3 && sheets.some((s) => s.character.name === 'Rook' && s.character.damage.physical === 4)
    },
    campaign.id,
    { timeout: 60000, polling: 1000 },
  )

  // GM: run log, an encounter
  const encounterId = await gm.page.evaluate(async (roomId) => {
    const { db } = await import('/src/db/db.ts')
    const { updateCampaign } = await import('/src/gm/store.ts')
    const sheets = await db.sharedSheets.where('roomId').equals(roomId).toArray()
    const runner = (s) => s.character
    await updateCampaign(roomId, {
      joinHidden: true,
      notes: 'Mr. Johnson (Aztechnology?) wants the prototype before Friday.\nThe Halloweeners still owe Rook a favour.',
      runs: [
        { id: 'r1', date: '2026-10-04', title: 'Milk run in Redmond', notes: 'Courier job went sideways at the Barrens checkpoint.', karma: 5, nuyen: 4000, runnerIds: sheets.map((s) => runner(s).id), runnerNames: sheets.map((s) => runner(s).name) },
        { id: 'r2', date: '2026-10-11', title: 'The Renraku data heist', notes: 'Glitch got the paydata; Whisper burned two Edge to get them out.', karma: 7, nuyen: 8000, runnerIds: sheets.map((s) => runner(s).id), runnerNames: sheets.map((s) => runner(s).name) },
      ],
    })
    const { newEncounter, rollInitiative, startCombat, combatantStats } = await import('/src/rules/sr6/encounter.ts')
    const { ParticipantSchema } = await import('/src/model/encounter.ts')
    let e = { ...newEncounter('Ambush at the docks'), campaignId: roomId }
    const custom = { initiativeScore: 7, initiativeDice: 1, defenseRating: 4, monitor: 10, pool: 8 }
    e.participants = [
      ...[1, 2, 3].map((i) => ParticipantSchema.parse({ kind: 'custom', name: `Ganger ${i}`, group: 'Ganger', custom })),
      ParticipantSchema.parse({ kind: 'spirit', name: 'Fire spirit (Force 4)', spirit: { type: 'fire', force: 4 } }),
      ...sheets.map((s, i) => ParticipantSchema.parse({ kind: 'runner', name: s.character.name, characterId: `shared:${s.id}`, initiative: [14, 11, 9][i] ?? 10 })),
    ]
    const stats = new Map(e.participants.map((p) => [p.id, combatantStats(p, p.characterId ? sheets.find((s) => `shared:${s.id}` === p.characterId)?.character : undefined)]))
    let n = 0
    e = rollInitiative(e, stats, false, () => [0.6, 0.2, 0.9, 0.5][n++ % 4])
    e = startCombat(e, stats)
    e.participants = e.participants.map((p) =>
      p.name === 'Ganger 2'
        ? { ...p, damage: { physical: 5, stun: 0 }, statuses: [{ id: 's1', name: 'Burning', value: 2, rounds: null }] }
        : p.name === 'Ganger 1'
          ? { ...p, majorLeft: 0 }
          : p,
    )
    await db.encounters.add(e)
    return e.id
  }, campaign.id)

  await go(gm.page, `#/gm/campaign/${campaign.id}`)
  await hideBackupBanner(gm.page)
  await shot(gm.page, 'campaign-full', { fullPage: true })
  await go(gm.page, '#/gm')
  await hideBackupBanner(gm.page)
  await shot(gm.page, 'gm-home')

  await go(gm.page, `#/gm/${encounterId}`)
  await gm.page.getByText('Round', { exact: false }).first().waitFor({ timeout: 15000 })
  await shot(gm.page, 'encounter')
  // A roll from the encounter screen
  const pool = gm.page.locator('button', { hasText: 'Main pool' }).nth(2)
  if (await pool.count()) {
    await pool.click()
    await wait(600)
    await shot(gm.page, 'encounter-roll')
    await gm.page.getByRole('button', { name: 'Close roll' }).click()
  }
  await gm.page.getByRole('button', { name: 'Add', exact: true }).click()
  await wait(500)
  await gm.page.getByRole('button', { name: 'Spirit', exact: true }).click()
  await wait(400)
  await shot(gm.page, 'encounter-add')
  await gm.page.keyboard.press('Escape')

  // Read-only sheet
  const sheetPath = await gm.page.evaluate(async (roomId) => {
    const { db } = await import('/src/db/db.ts')
    const s = (await db.sharedSheets.where('roomId').equals(roomId).toArray()).find((x) => x.character.name === 'Whisper')
    return `#/gm/sheet/${encodeURIComponent(s.id)}`
  }, campaign.id)
  await go(gm.page, sheetPath)
  await shot(gm.page, 'shared-sheet')

  // Rules reference
  await go(gm.page, '#/rules')
  await shot(gm.page, 'rules')
  await gm.page.getByPlaceholder(/Search/).fill('cover')
  await wait(800)
  await shot(gm.page, 'rules-search')
} finally {
  await gm.page.evaluate(async (id) => {
    const C = await import('/src/share/campaigns.ts')
    await C.closeCampaign(id)
  }, campaign.id)
  console.log('campaign closed')
  await browser.close()
}
