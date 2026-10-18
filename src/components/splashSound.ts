/**
 * Sound effects for the intro, made with the Web Audio API (no audio files):
 * typing ticks, a rising whoosh, a jack-in thump with static, and a shimmer.
 * Times match the CSS animation in index.css (milliseconds from the start).
 */

type Cue = { at: number; play: (ctx: AudioContext, out: AudioNode, t: number) => void }

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** A short burst of typing ticks for one boot line. */
function ticks(ctx: AudioContext, out: AudioNode, t: number, count = 8) {
  for (let i = 0; i < count; i++) {
    const start = t + i * 0.055 + Math.random() * 0.015
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1400 + Math.random() * 900
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.03)
    osc.connect(gain).connect(out)
    osc.start(start)
    osc.stop(start + 0.04)
  }
}

/** Filtered noise sweeping up, with a rising sine underneath: the logo powering on. */
function whoosh(ctx: AudioContext, out: AudioNode, t: number) {
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer(ctx, 1)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 6
  filter.frequency.setValueAtTime(250, t)
  filter.frequency.exponentialRampToValueAtTime(3500, t + 0.8)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.25, t + 0.55)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  noise.connect(filter).connect(gain).connect(out)
  noise.start(t)
  noise.stop(t + 1)

  const osc = ctx.createOscillator()
  const g2 = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(90, t)
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.8)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1200
  g2.gain.setValueAtTime(0.0001, t)
  g2.gain.exponentialRampToValueAtTime(0.06, t + 0.6)
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.85)
  osc.connect(lp).connect(g2).connect(out)
  osc.start(t)
  osc.stop(t + 0.9)
}

/** A deep thump with a pitch drop, and a crackle of static: jacking in. */
function thump(ctx: AudioContext, out: AudioNode, t: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(130, t)
  osc.frequency.exponentialRampToValueAtTime(38, t + 0.45)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.7, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
  osc.connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 0.65)

  // Glitchy static in a few short slices, in step with the title's colour split.
  for (const [offset, length] of [
    [0, 0.06],
    [0.09, 0.04],
    [0.2, 0.05],
    [0.36, 0.03],
  ]) {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx, length)
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 2500
    const g = ctx.createGain()
    g.gain.value = 0.12
    noise.connect(hp).connect(g).connect(out)
    noise.start(t + offset)
  }
}

/** Two soft high notes fading in and out: the tagline. */
function shimmer(ctx: AudioContext, out: AudioNode, t: number) {
  for (const freq of [659.25, 987.77, 1318.5]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.04, t + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 1.05)
  }
}

const CUES: Cue[] = [
  { at: 120, play: (c, o, t) => ticks(c, o, t, 6) },
  { at: 420, play: (c, o, t) => ticks(c, o, t, 9) },
  { at: 550, play: whoosh },
  { at: 720, play: (c, o, t) => ticks(c, o, t, 10) },
  { at: 1000, play: thump },
  { at: 1600, play: shimmer },
]

export interface SplashSound {
  /** True when the browser blocked sound until the user taps. */
  blocked: () => boolean
  /** Try to (re)start sound, playing the cues still to come. Call from a tap to unlock it. */
  unlock: () => void
  stop: () => void
}

/**
 * Start the intro sounds. `startedAt` is when the animation began
 * (performance.now()), so a late unlock plays only what's still ahead.
 */
export function playSplashSound(startedAt: number): SplashSound | null {
  const AudioCtx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  const played = new Set<Cue>()
  let ctx: AudioContext
  let out: GainNode

  const make = () => {
    ctx = new AudioCtx()
    out = ctx.createGain()
    out.gain.value = 0.6
    out.connect(ctx.destination)
  }
  const schedule = () => {
    if (ctx.state !== 'running') return
    const elapsed = performance.now() - startedAt
    for (const cue of CUES) {
      if (played.has(cue) || cue.at < elapsed - 80) continue
      played.add(cue)
      cue.play(ctx, out, ctx.currentTime + Math.max(0, cue.at - elapsed) / 1000)
    }
  }
  const start = () => {
    // resume() must be called right away, inside the tap, for the browser to allow it.
    const resumed = ctx.resume()
    schedule()
    void resumed.then(schedule).catch(() => {})
  }

  make()
  start()
  return {
    blocked: () => ctx.state !== 'running',
    unlock: () => {
      if (ctx.state === 'running') return
      // Some browsers (iOS Safari) only unlock audio created during the tap itself.
      void ctx.close().catch(() => {})
      make()
      start()
    },
    stop: () => {
      const closing = ctx
      out.gain.setTargetAtTime(0, closing.currentTime, 0.08)
      setTimeout(() => void closing.close().catch(() => {}), 400)
    },
  }
}
