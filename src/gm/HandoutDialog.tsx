import { ImagePlus, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { noAutofill, noAutofillField } from '../components/noAutofill'
import type { Campaign, SharedSheet } from '../db/db'
import { isFileSheet } from '../share/campaigns'
import { pictureFrom, shrinkImage } from '../share/image'
import { sendToRunner } from '../share/messages'

/**
 * GM: send a handout (a map, a picture, a message from the Johnson) to some
 * or all of the runners shared live. It pops up on their sheets; they keep it
 * or dismiss it, and it never changes the sheet.
 */
export function HandoutDialog({
  campaign,
  runners,
  onClose,
}: {
  campaign: Campaign
  runners: SharedSheet[]
  onClose: () => void
}) {
  const live = runners.filter((s) => !isFileSheet(s))
  const [to, setTo] = useState<string[]>(live.map((s) => s.id))
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState('')
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  /** Shrink and use a picture, from a file, a drop or a paste. */
  const takePicture = async (get: () => Promise<Blob | null | undefined>) => {
    setError('')
    setReading(true)
    try {
      const blob = await get()
      if (blob) setImage(await shrinkImage(blob))
      else setError('There’s no picture in that. Drop or paste the picture itself.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReading(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    // Paste a picture copied anywhere ("Copy image" in a browser, a screenshot). Text pastes into fields as usual.
    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData
      if (!data || ![...data.items].some((i) => i.kind === 'file' && i.type.startsWith('image/'))) return
      e.preventDefault()
      void takePicture(() => pictureFrom(data))
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [onClose])

  // Drops anywhere over the dialog count, so a near miss doesn't make the browser open the picture.
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      if (!dragging) setDragging(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget === e.target) setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const data = e.dataTransfer
      void takePicture(() => pictureFrom(data))
    },
  }

  const send = async () => {
    setBusy(true)
    setError('')
    const sent: string[] = []
    const failed: string[] = []
    for (const sheet of live.filter((s) => to.includes(s.id))) {
      try {
        await sendToRunner(campaign, sheet, {
          kind: 'handout',
          title: title.trim(),
          text: text.trim(),
          image,
          note: '',
        })
        sent.push(sheet.character.name)
      } catch (e) {
        failed.push(`${sheet.character.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    setBusy(false)
    if (failed.length) setError(`Couldn’t send to ${failed.join('; ')}`)
    if (sent.length) {
      setResult(`Sent to ${sent.join(', ')}.`)
      setTitle('')
      setText('')
      setImage(undefined)
    }
  }

  const empty = !title.trim() && !text.trim() && !image
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
      {...dropHandlers}
    >
      <form
        className="card max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none p-5 text-sm sm:rounded-b-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (!empty && to.length) void send()
        }}
        aria-label="Send a handout"
      >
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto font-display text-xl">Send a handout</h2>
          <button type="button" className="text-muted hover:text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        {live.length === 0 ? (
          <p className="text-muted">No runners shared live yet. Handouts go to players who joined the campaign.</p>
        ) : (
          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs text-muted">To</div>
              <div className="flex flex-wrap gap-1.5">
                {live.map((s) => {
                  const on = to.includes(s.id)
                  return (
                    <button
                      type="button"
                      key={s.id}
                      className={`chip cursor-pointer ${on ? 'border-accent bg-accent/15 text-accent' : 'text-muted'}`}
                      onClick={() => setTo(on ? to.filter((id) => id !== s.id) : [...to, s.id])}
                    >
                      {s.character.name}
                    </button>
                  )
                })}
              </div>
            </div>
            <label>
              <div className="mb-1 text-xs text-muted">Title</div>
              <input
                {...noAutofill}
                className="input w-full"
                placeholder="Floor plan, Message from Mr. Tanaka…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              <div className="mb-1 text-xs text-muted">Text</div>
              <textarea
                {...noAutofillField}
                className="input field-sizing-content min-h-20 w-full"
                placeholder="Skybar, 7th floor. Come alone. Wear something nice."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <div>
              <div className="mb-1 text-xs text-muted">Picture</div>
              {image ? (
                <div className="relative">
                  <img src={image} alt="" className="max-h-60 w-full rounded-lg object-contain" />
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white"
                    onClick={() => setImage(undefined)}
                    aria-label="Remove picture"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                    dragging ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted'
                  }`}
                >
                  <ImagePlus className="size-6" />
                  <div>
                    {reading
                      ? 'Getting the picture…'
                      : dragging
                        ? 'Drop it here'
                        : 'Drag a picture here from another browser tab or a folder, or paste one (Ctrl+V / ⌘V).'}
                  </div>
                  <button type="button" className="btn text-xs" onClick={() => file.current?.click()}>
                    Or choose a file
                  </button>
                </div>
              )}
              <input
                ref={file}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  void takePicture(async () => f)
                }}
              />
              <p className="mt-1 text-xs text-muted">
                It’s shrunk to fit; maps stay readable up to about 1600 pixels. Dropping a new one replaces it.
              </p>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            {result && <p className="text-xs text-accent">{result}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={busy || empty || to.length === 0}>
                <Send className="size-4" /> {busy ? 'Sending…' : 'Send'}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </form>
    </div>,
    document.body,
  )
}
