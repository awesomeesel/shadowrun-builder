/** Largest data URL a handout image may be, so the sealed message stays well under Firestore's 1 MB. */
export const MAX_HANDOUT_IMAGE = 450_000

/**
 * Shrink a picture to a JPEG data URL under `maxLength` characters: at most
 * `maxSide` pixels on the long side, lowering quality and then size until it fits.
 */
export async function shrinkImage(file: Blob, maxSide = 1600, maxLength = MAX_HANDOUT_IMAGE): Promise<string> {
  const bitmap = await createImageBitmap(file)
  let side = Math.min(maxSide, Math.max(bitmap.width, bitmap.height))
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      const scale = side / Math.max(bitmap.width, bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Can’t read the picture in this browser.')
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.7, 0.55]) {
        const url = canvas.toDataURL('image/jpeg', quality)
        if (url.length <= maxLength) return url
      }
      side = Math.round(side * 0.75)
    }
  } finally {
    bitmap.close()
  }
  throw new Error('The picture is too big to send, even shrunk.')
}

/** Thrown when a picture's site doesn't let other pages fetch it. */
export const BLOCKED_PICTURE =
  'That site won’t hand over the picture. Right-click it, choose “Copy image”, then paste here with Ctrl+V (⌘V on a Mac).'

/** A web address of a picture in dropped or pasted data: a link, an <img> in HTML, or plain text. */
export function pictureUrl(data: { uriList?: string; html?: string; text?: string }): string | null {
  const fromList = data.uriList
    ?.split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'))
  const fromHtml = data.html?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&')
  const fromText = data.text?.trim()
  for (const url of [fromHtml, fromList, fromText]) {
    if (url && /^(https?:|data:image\/)/i.test(url)) return url
  }
  return null
}

/** Fetch a picture by its address; throws BLOCKED_PICTURE when the site refuses or it isn't a picture. */
export async function fetchPicture(url: string): Promise<Blob> {
  let blob: Blob
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(String(response.status))
    blob = await response.blob()
  } catch {
    throw new Error(BLOCKED_PICTURE)
  }
  if (!blob.type.startsWith('image/')) throw new Error(BLOCKED_PICTURE)
  return blob
}

/**
 * The picture in a drop or paste: a file (from the desktop, or some browsers'
 * drags), or else the address of one dragged from another web page. Null when
 * there's no picture in it.
 */
export async function pictureFrom(transfer: DataTransfer): Promise<Blob | null> {
  const file =
    [...transfer.files].find((f) => f.type.startsWith('image/')) ??
    [...transfer.items].find((i) => i.kind === 'file' && i.type.startsWith('image/'))?.getAsFile()
  if (file) return file
  const url = pictureUrl({
    uriList: transfer.getData('text/uri-list'),
    html: transfer.getData('text/html'),
    text: transfer.getData('text/plain'),
  })
  return url ? fetchPicture(url) : null
}
