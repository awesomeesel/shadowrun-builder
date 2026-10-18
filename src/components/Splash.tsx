import { useEffect, useState } from 'react'
import { Logo } from './art'

/** Set (in sessionStorage) by screenshot scripts to keep the intro out of the way. */
const SKIP_KEY = 'splashSeen'
/** How long the whole sequence runs before it fades out, in ms. The CSS timings in index.css match this. */
const LENGTH = 4500

const BOOT: { text: string; alert?: boolean }[] = [
  { text: '> JACKING IN…' },
  { text: '> SIN VERIFIED · ACCESS GRANTED' },
  { text: '> WARNING: HOSTILE ICE DETECTED', alert: true },
]

/** Where the three shots hit, in percent of the screen, clear of the title in the middle. */
const SHOTS = [
  { x: 18, y: 30, at: 1500, angle: -24 },
  { x: 80, y: 24, at: 1680, angle: 200 },
  { x: 70, y: 74, at: 1830, angle: 160 },
]

const TAGLINES = [
  'Plan the run. Run the plan.',
  'The shadows are calling, chummer.',
  'Check your ammo. Trust no Johnson.',
  'Seattle never sleeps. Neither do you.',
  'Get paid. Get out. Stay alive.',
]

function shouldPlay(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    return sessionStorage.getItem(SKIP_KEY) !== '1'
  } catch {
    return false
  }
}

/** A bullet hole with cracked glass around it. */
function BulletHole() {
  const cracks = [12, 58, 103, 150, 197, 241, 290, 334]
  return (
    <svg viewBox="-50 -50 100 100" className="splash-hole-svg" aria-hidden>
      {cracks.map((a, i) => {
        const r = 22 + ((i * 37) % 26)
        const rad = (a * Math.PI) / 180
        const mid = ((a + 9) * Math.PI) / 180
        return (
          <polyline
            key={a}
            points={`0,0 ${Math.cos(mid) * r * 0.5},${Math.sin(mid) * r * 0.5} ${Math.cos(rad) * r},${Math.sin(rad) * r}`}
            fill="none"
            stroke="rgba(220,240,255,0.55)"
            strokeWidth="1"
          />
        )
      })}
      <circle r="16" fill="none" stroke="rgba(220,240,255,0.25)" strokeWidth="0.8" />
      <circle r="5.5" fill="#05060a" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
    </svg>
  )
}

/**
 * The intro when the app opens: the runner jacks in, hostile ICE shows up, a
 * laser sight sweeps, three shots crack the screen, and the logo slams in.
 * Plays on every load; any tap or key skips it; never shown to people who
 * asked for less motion.
 */
export function Splash() {
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'done'>(() => (shouldPlay() ? 'playing' : 'done'))
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)])

  useEffect(() => {
    if (phase === 'done') return
    const leave = setTimeout(() => setPhase('leaving'), phase === 'leaving' ? 0 : LENGTH)
    const done = setTimeout(() => setPhase('done'), (phase === 'leaving' ? 0 : LENGTH) + 450)
    const skip = () => setPhase('leaving')
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(leave)
      clearTimeout(done)
      window.removeEventListener('keydown', skip)
    }
  }, [phase])

  if (phase === 'done') return null
  return (
    <div
      className={`splash ${phase === 'leaving' ? 'splash-leave' : ''}`}
      onClick={() => setPhase('leaving')}
      role="presentation"
      aria-hidden
    >
      <div className="splash-stage">
        <div className="splash-grid" />
        <div className="splash-laser" />
        <div className="splash-boot">
          {BOOT.map((line, i) => (
            <div
              key={line.text}
              className={`splash-line ${line.alert ? 'splash-alert' : ''}`}
              style={{ animationDelay: `${100 + i * 280}ms` }}
            >
              {line.text}
            </div>
          ))}
        </div>
        <div className="splash-crosshair">
          <span className="splash-lock">TARGET LOCKED</span>
        </div>
        {SHOTS.map((s) => (
          <div key={s.at} className="splash-shot" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
            <div className="splash-tracer" style={{ rotate: `${s.angle}deg`, animationDelay: `${s.at - 70}ms` }} />
            <div className="splash-hole" style={{ animationDelay: `${s.at}ms` }}>
              <BulletHole />
            </div>
          </div>
        ))}
        <div className="splash-center">
          <div className="splash-shockwave" />
          <div className="splash-logo">
            <Logo className="size-24 sm:size-28" />
          </div>
          <h1 className="splash-title" data-text="SHADOWRUN BUILDER">
            SHADOWRUN BUILDER
          </h1>
          <p className="splash-tagline">{tagline}</p>
        </div>
        <div className="splash-bar">
          <span />
        </div>
      </div>
      <div className="splash-flash" />
      <div className="splash-scan" />
      <span className="splash-skip">tap to skip</span>
    </div>
  )
}
