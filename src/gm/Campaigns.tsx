import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Eye,
  FileInput,
  Minimize2,
  NotebookPen,
  Plus,
  QrCode,
  Send,
  Swords,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router'
import { Portrait } from '../components/art'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import { db, type Campaign, type OutboxItem, type SharedSheet } from '../db/db'
import { parseImportFile } from '../model/fileFormat'
import { computeDerived } from '../rules/sr6/derived'
import { newEncounter } from '../rules/sr6/encounter'
import { METATYPES } from '../rules/sr6/metatypes'
import {
  closeCampaign,
  NotCampaignOwnerError,
  removeCampaignHere,
  createCampaign,
  importSharedFile,
  isFileSheet,
  joinLink,
  latestSheets,
  removeSharedSheet,
  sheetPath,
} from '../share/campaigns'
import { timeAgo } from '../share/timeAgo'
import type { CharacterContext } from '../pages/character/CharacterPage'
import { BackupStatus } from './BackupStatus'
import { EncounterList } from './EncounterList'
import { SendDialog } from './SendDialog'
import { cancelMessage, describeMessage, gmSends } from '../share/messages'
import { updateCampaign } from './store'
import { CastSection } from './Cast'
import { PartyOverview } from './PartyOverview'
import { RunLog } from './RunLog'

export function NewCampaignDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const campaign = await createCampaign(name.trim() || 'Campaign', password.trim())
      navigate(`/gm/campaign/${campaign.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        className="card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto font-display text-xl">New campaign</h2>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <label className="mb-3 block">
          <div className="mb-1 text-xs text-muted">Name (players see it when they join)</div>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="Seattle Nights"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label className="mb-1 block">
          <div className="mb-1 text-xs text-muted">Password (optional)</div>
          <input
            {...noAutofill}
            className="input w-full"
            placeholder="Something to say at the table"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <p className="mb-4 text-xs text-muted">
          You get a code like K7QM-4XRA-P2DN. Players need the code and, if you set one, the password. Together they
          lock the sheets, so the server can’t read them. A password you share by voice keeps out anyone who only saw
          the code.
        </p>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Making…' : 'Make campaign'}
        </button>
      </form>
    </div>
  )
}

/** One campaign: how to join, its runners (live or from files), encounters and notes. */
export function CampaignPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const campaign = useLiveQuery(async () => (await db.campaigns.get(id)) ?? null, [id])
  const sheets = useLiveQuery(() => db.sharedSheets.where('roomId').equals(id).toArray(), [id])
  const encounters = useLiveQuery(async () => (await db.encounters.toArray()).filter((e) => e.campaignId === id), [id])
  const [notice, setNotice] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  if (campaign === undefined) return null
  if (campaign === null) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">Campaign not found on this device.</p>
        <Link to="/gm" className="btn">
          Back to the GM screen
        </Link>
      </div>
    )
  }
  const runners = latestSheets(sheets ?? [])

  const importFiles = async (list: FileList | null) => {
    const names: string[] = []
    for (const file of Array.from(list ?? [])) {
      try {
        const { characters } = parseImportFile(await file.text())
        for (const c of characters) {
          await importSharedFile(campaign.id, c)
          names.push(c.name)
        }
      } catch (error) {
        setNotice(`${file.name}: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
    }
    if (names.length) setNotice(`Added ${names.join(', ')}.`)
  }

  const newEncounterHere = async () => {
    const encounter = { ...newEncounter(`Encounter ${(encounters?.length ?? 0) + 1}`), campaignId: campaign.id }
    await db.encounters.add(encounter)
    navigate(`/gm/${encounter.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/gm" className="text-muted hover:text-fg" aria-label="Back to the GM screen">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="mr-auto font-display text-3xl font-semibold">{campaign.name}</h1>
        {campaign.joinHidden && (
          <button className="btn" onClick={() => setShowJoin(true)} title="QR code, code and password for players">
            <QrCode className="size-4" /> Join info
          </button>
        )}
        <Link to="/rules" className="btn">
          <BookOpen className="size-4" /> <span className="hidden sm:inline">Rules</span>
        </Link>
      </div>
      <BackupStatus />
      <div className="grid grid-cols-1 gap-8">
        {!campaign.joinHidden && (
          <JoinCard campaign={campaign} onHide={() => void updateCampaign(campaign.id, { joinHidden: true })} />
        )}
        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
              <Users className="size-5 text-accent" /> Runners
              <span className="text-xs font-normal text-muted">
                {campaign.error ? (
                  <span className="text-amber">{campaign.error}</span>
                ) : (
                  campaign.lastSyncAt && `live · last update ${timeAgo(campaign.lastSyncAt)}`
                )}
              </span>
            </h2>
            <button
              className="btn text-sm"
              onClick={() => fileInput.current?.click()}
              title="A character file a player sent you (for when there's no internet)"
            >
              <FileInput className="size-4" /> Import a runner’s file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={(e) => {
                void importFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {notice && <p className="mb-2 text-sm text-accent">{notice}</p>}
          <SendSettings campaign={campaign} />
          {runners.length === 0 ? (
            <div className="card p-6 text-sm text-muted">
              No runners yet. Players scan the QR code or open the link, then pick the characters to share.
            </div>
          ) : (
            <ul className="grid gap-2">
              {runners.map((s) => (
                <RunnerRow key={s.id} sheet={s} campaign={campaign} />
              ))}
            </ul>
          )}
        </section>
        {runners.length > 0 && <PartyOverview runners={runners} />}
        <CastSection campaign={campaign} />
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="mr-auto flex items-center gap-2 font-display text-xl">
              <Swords className="size-5 text-accent" /> Encounters
            </h2>
            <button className="btn btn-primary text-sm" onClick={() => void newEncounterHere()}>
              <Plus className="size-4" /> New encounter
            </button>
          </div>
          <EncounterList encounters={encounters ?? []} empty="No encounters yet. Prepare the next fight here." />
        </section>
        <RunLog campaign={campaign} runners={runners} />
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-display text-xl">
            <NotebookPen className="size-5 text-accent" /> Notes
            <span className="text-xs font-normal text-muted">only on this device; players never see them</span>
          </h2>
          <textarea
            {...noAutofillField}
            className="input field-sizing-content max-h-80 min-h-16 w-full text-sm"
            rows={2}
            placeholder="Plot threads, recurring NPCs, who owes whom, loose ends…"
            value={campaign.notes ?? ''}
            onChange={(e) => void updateCampaign(campaign.id, { notes: e.target.value })}
          />
        </section>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4 text-sm">
          <button
            className="btn text-danger"
            onClick={async () => {
              if (
                !confirm(
                  `Close "${campaign.name}"? Players stop sharing and their sheets are removed from the server. Its encounters stay on this device.`,
                )
              )
                return
              try {
                await closeCampaign(campaign.id)
                navigate('/gm')
              } catch (e) {
                if (e instanceof NotCampaignOwnerError) {
                  const ok = confirm(
                    `${e.message} Open it on that device to close it. Remove it from this GM screen and your Drive backup anyway? Players keep sharing until they leave.`,
                  )
                  if (ok) {
                    await removeCampaignHere(campaign.id)
                    navigate('/gm')
                  }
                } else alert(e instanceof Error ? e.message : String(e))
              }
            }}
          >
            <Trash2 className="size-4" /> Close campaign
          </button>
        </div>
      </div>
      {showJoin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowJoin(false)}
        >
          <JoinCard campaign={campaign} dialog onHide={() => setShowJoin(false)} />
        </div>
      )}
    </div>
  )
}

/**
 * How players join: QR code, code, password and link. Shown on the page until
 * the GM hides it; then it opens as a dialog from "Join info" in the header.
 */
function JoinCard({ campaign, onHide, dialog = false }: { campaign: Campaign; onHide: () => void; dialog?: boolean }) {
  const [withPassword, setWithPassword] = useState(true)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const link = joinLink(campaign, withPassword)
  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(link, { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(
      (url) => !cancelled && setQr(url),
    )
    return () => {
      cancelled = true
    }
  }, [link])
  return (
    <section className={dialog ? 'card w-full max-w-xl p-5' : 'card p-4'} onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-start gap-2">
        <h2 className="mr-auto font-display text-lg">
          Join this campaign
          {!dialog && (
            <span className="block text-xs font-normal text-muted">
              Show this to your players. Hide it when everyone is in; it stays under Join info at the top.
            </span>
          )}
        </h2>
        <button
          className="btn px-2 py-1 text-xs"
          onClick={onHide}
          aria-label={dialog ? 'Close' : 'Hide join info'}
          title={dialog ? 'Close' : 'Hide; open it again with Join info at the top'}
        >
          {dialog ? <X className="size-4" /> : <Minimize2 className="size-3.5" />}
          {!dialog && 'Hide'}
        </button>
      </div>
      <div className={`flex flex-col items-center gap-4 ${dialog ? '' : 'sm:flex-row sm:items-start'}`}>
        {qr && (
          <img
            src={qr}
            alt="QR code for joining"
            className={`rounded-lg bg-white p-2 ${dialog ? 'w-full max-w-80' : 'w-40 shrink-0'}`}
          />
        )}
        <div className={`grid min-w-0 flex-1 gap-3 ${dialog ? 'w-full text-center' : ''}`}>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className={dialog ? 'w-full' : ''}>
              <div className="text-xs text-muted">Code</div>
              <div className="font-mono text-2xl tracking-wider text-accent select-all">{campaign.code}</div>
            </div>
            {campaign.password && (
              <div className={dialog ? 'w-full' : ''}>
                <div className="text-xs text-muted">Password</div>
                <div className="font-mono text-2xl select-all">{campaign.password}</div>
              </div>
            )}
          </div>
          {campaign.password && (
            <label className="flex items-start gap-2 text-left text-xs text-muted">
              <input type="checkbox" checked={withPassword} onChange={(e) => setWithPassword(e.target.checked)} />
              Put the password in the QR code and link. Untick to say it out loud instead.
            </label>
          )}
          <div className={`flex flex-wrap items-center gap-3 ${dialog ? 'justify-center' : ''}`}>
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(link)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{' '}
              {copied ? 'Copied' : 'Copy join link'}
            </button>
            <p className="text-xs text-muted">
              Players scan with their phone camera, open the link, or choose Share with GM on a character and type the
              code.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function RunnerRow({ sheet, campaign }: { sheet: SharedSheet; campaign: Campaign }) {
  const c = sheet.character
  const d = computeDerived(c)
  const [sending, setSending] = useState(false)
  const waiting = useLiveQuery(
    () =>
      db.outbox
        .where('roomId')
        .equals(campaign.id)
        .filter((m) => m.to === sheet.sheetId)
        .toArray(),
    [campaign.id, sheet.sheetId],
  )
  const sends = gmSends(campaign)
  const canSend = !isFileSheet(sheet) && (sends.damage || sends.rewards)
  return (
    <li className="card flex flex-wrap items-center gap-3 p-3">
      <Portrait src={c.portrait} metatype={c.metatype} className="size-10" />
      <Link to={sheetPath(sheet)} className="min-w-0 flex-1 basis-40">
        <div className="truncate font-display text-lg hover:text-accent">{c.name}</div>
        <div className="truncate text-xs text-muted">
          {METATYPES[c.metatype].name}
          {c.concept && ` · ${c.concept}`}
          {c.playerName && ` · ${c.playerName}`}
        </div>
      </Link>
      <div className="flex flex-wrap gap-3 text-xs tabular-nums">
        <Gauge label="Physical" value={c.damage.physical} max={d.physicalMonitor.boxes} />
        <Gauge label="Stun" value={c.damage.stun} max={d.stunMonitor.boxes} />
        <span className="text-muted">
          Edge <span className="text-amber">{c.play.edge ?? d.attributes.edge}</span>/{d.attributes.edge}
        </span>
        <span className="text-muted" title={new Date(sheet.updatedAt).toLocaleString()}>
          {isFileSheet(sheet) ? 'file · ' : ''}
          {timeAgo(sheet.updatedAt)}
        </span>
      </div>
      <div className="flex gap-1">
        {canSend && (
          <button
            className="btn px-2 py-1 text-xs"
            onClick={() => setSending(true)}
            title="Damage, a status, Edge or karma and nuyen"
          >
            <Send className="size-3.5" /> Send…
          </button>
        )}
        <Link to={sheetPath(sheet)} className="btn px-2 py-1 text-xs">
          <Eye className="size-3.5" /> Sheet
        </Link>
        <button
          className="btn px-2 py-1 text-xs text-muted hover:text-danger"
          onClick={() => {
            if (confirm(`Remove ${c.name} from the campaign? The player can share again.`))
              void removeSharedSheet(sheet).catch((e) => alert(String(e)))
          }}
          aria-label={`Remove ${c.name}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {waiting && waiting.length > 0 && <Waiting items={waiting} />}
      {sending && <SendDialog campaign={campaign} sheet={sheet} onClose={() => setSending(false)} />}
    </li>
  )
}

/** Messages the player hasn't accepted or declined yet; the GM can take them back. */
export function Waiting({ items }: { items: OutboxItem[] }) {
  return (
    <div className="flex basis-full flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted">Waiting for the player:</span>
      {items.map((item) => (
        <span key={item.id} className="chip gap-1 text-xs">
          {describeMessage(item.message)}
          <button
            className="text-muted hover:text-danger"
            onClick={() => void cancelMessage(item).catch((e) => alert(String(e)))}
            aria-label={`Take back ${describeMessage(item.message)}`}
            title="Take it back"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

/** What the GM may send to players' sheets in this campaign. */
function SendSettings({ campaign }: { campaign: Campaign }) {
  const sends = gmSends(campaign)
  const set = (change: Partial<typeof sends>) => void updateCampaign(campaign.id, { gmSends: { ...sends, ...change } })
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span title="Nothing is sent unless you choose to, and players accept or decline each one">
        You can send players:
      </span>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={sends.damage} onChange={(e) => set({ damage: e.target.checked })} />
        damage, statuses and Edge
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={sends.rewards} onChange={(e) => set({ rewards: e.target.checked })} />
        karma and nuyen
      </label>
    </div>
  )
}

function Gauge({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <span className="text-muted">
      {label}{' '}
      <span className={value >= max ? 'text-danger' : value > 0 ? 'text-fg' : ''}>
        {value}/{max}
      </span>
    </span>
  )
}

/** A player's sheet, read-only, using the same Sheet view the player has. */
export function SharedSheetPage() {
  const { key = '' } = useParams()
  const id = decodeURIComponent(key)
  const sheet = useLiveQuery(async () => (await db.sharedSheets.get(id)) ?? null, [id])
  if (sheet === undefined) return null
  if (sheet === null) {
    return (
      <div className="p-8 text-center">
        <p className="mb-4">This sheet isn’t shared any more.</p>
        <Link to="/gm" className="btn">
          Back to the GM screen
        </Link>
      </div>
    )
  }
  const c = sheet.character
  const back = `/gm/campaign/${sheet.roomId}`
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-8">
          <Link to={back} className="text-muted hover:text-fg" aria-label="Back">
            <ArrowLeft className="size-5" />
          </Link>
          <Portrait src={c.portrait} metatype={c.metatype} className="size-10" />
          <div className="mr-auto min-w-0">
            <h1 className="truncate font-display text-xl leading-tight font-semibold">{c.name}</h1>
            <div className="truncate text-xs text-muted">
              {METATYPES[c.metatype].name}
              {c.playerName && ` · ${c.playerName}`}
            </div>
          </div>
          <span className="chip text-xs text-muted" title="Only the player can change this character">
            <Eye className="size-3.5" /> Read-only · {isFileSheet(sheet) ? 'from a file, ' : 'live, '}
            {timeAgo(sheet.updatedAt)}
          </span>
        </div>
      </header>
      {/* Clicks on the sheet do nothing: the player owns it. */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <Outlet context={{ character: c, update: () => {} } satisfies CharacterContext} />
      </main>
    </div>
  )
}
