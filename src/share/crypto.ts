/**
 * Campaign codes and end-to-end encryption for sharing sheets with the GM.
 * The code and password never leave the device: they derive both the room's
 * id in the database and the key that seals every sheet, so the server only
 * ever stores ciphertext and can't tell which room belongs to whom.
 */

/** No 0/O, 1/I/L or U, so codes are easy to read aloud and type. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'
const GROUPS = 3
const GROUP_LENGTH = 4

/** A new campaign code like "K7QM-4XRA-P2DN" (about 58 bits). */
export function generateCode(random: (n: number) => Uint8Array = randomBytes): string {
  const length = GROUPS * GROUP_LENGTH
  let out = ''
  // Rejection sampling keeps every character equally likely.
  while (out.length < length) {
    for (const byte of random(length)) {
      if (byte < 240 && out.length < length) out += ALPHABET[byte % ALPHABET.length]
    }
  }
  return out.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-')
}

/** "k7qm 4xra-p2dn" → "K7QM-4XRA-P2DN"; null when it can't be a code. */
export function normalizeCode(text: string): string | null {
  const chars = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (chars.length !== GROUPS * GROUP_LENGTH || [...chars].some((c) => !ALPHABET.includes(c))) return null
  return chars.match(new RegExp(`.{${GROUP_LENGTH}}`, 'g'))!.join('-')
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export interface SessionKeys {
  /** Document id of the campaign in the database. */
  roomId: string
  key: CryptoKey
}

const SALT = new TextEncoder().encode('shadowrun-builder/campaign/v1')
const ITERATIONS = 150_000

/** Derive the room id and sheet key from the code and (optional) password. */
export async function deriveSession(code: string, password = ''): Promise<SessionKeys> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${code}\n${password}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: ITERATIONS },
      material,
      512,
    ),
  )
  const roomId = [...bits.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const key = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { roomId, key }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

/** JSON → gzip → AES-GCM, as "v1.<iv>.<ciphertext>" in base64. */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('gzip'))
  const iv = randomBytes(12) as Uint8Array<ArrayBuffer>
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, packed))
  return `v1.${toBase64(iv)}.${toBase64(cipher)}`
}

/** Undo `seal`. Throws when the key is wrong or the data was changed. */
export async function unseal<T = unknown>(key: CryptoKey, sealed: string): Promise<T> {
  const [version, iv, cipher] = sealed.split('.')
  if (version !== 'v1' || !iv || !cipher) throw new Error('Unknown format')
  const packed = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, key, fromBase64(cipher)),
  )
  return JSON.parse(new TextDecoder().decode(await pipe(packed, new DecompressionStream('gzip')))) as T
}
