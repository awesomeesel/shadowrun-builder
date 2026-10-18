import { Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Logo } from './art'
import { playSplashSound, type SplashSound } from './splashSound'

/** Set (in sessionStorage) by screenshot scripts to keep the intro out of the way. */
const SKIP_KEY = 'splashSeen'
const SOUND_KEY = 'splashSound'
/** How long the whole sequence runs before it fades out, in ms. */
const LENGTH = 2700

const BOOT = ['> JACKING IN…', '> SIN VERIFIED · ACCESS GRANTED', '> ICE BYPASSED · WELCOME TO THE SIXTH WORLD']

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

function soundWanted(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * A short "jacking into the Matrix" intro when the app opens: boot lines, the
 * logo flickering on, a glitching title, with synthesized sound. Plays on
 * every load; any tap or key skips it; never shown to people who asked for
 * less motion. Browsers block sound until a tap, so it offers "Tap for sound".
 */
export function Splash() {
  const [phase, setPhase] = useState<'playing' | 'leaving' | 'done'>(() => (shouldPlay() ? 'playing' : 'done'))
  const [tagline] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
  const [soundOn, setSoundOn] = useState(soundWanted)
  const [blocked, setBlocked] = useState(false)
  const sound = useRef<SplashSound | null>(null)
  const startedAt = useRef(0)

  // Start the sound with the animation; if the browser holds it back, offer a tap.
  useEffect(() => {
    if (phase === 'done' || !soundOn) return
    startedAt.current ||= performance.now()
    sound.current ??= playSplashSound(startedAt.current)
    const check = setTimeout(() => setBlocked(!!sound.current?.blocked()), 200)
    return () => clearTimeout(check)
  }, [phase, soundOn])
  useEffect(() => {
    if (phase !== 'done') return
    sound.current?.stop()
    sound.current = null
  }, [phase])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    } catch {
      // storage blocked
    }
    if (!next) {
      sound.current?.stop()
      sound.current = null
      setBlocked(false)
    }
  }

  useEffect(() => {
    if (phase === 'done') return
    startedAt.current ||= performance.now()
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
    >
      <div className="splash-grid" />
      <div className="splash-scan" />
      <div className="splash-boot">
        {BOOT.map((line, i) => (
          <div key={line} className="splash-line" style={{ animationDelay: `${120 + i * 300}ms` }}>
            {line}
          </div>
        ))}
      </div>
      <div className="splash-center">
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
      <div className="splash-sound" onClick={(e) => e.stopPropagation()}>
        {soundOn && blocked && (
          <button
            className="splash-sound-btn splash-sound-unlock"
            onClick={() => {
              sound.current?.unlock()
              setBlocked(false)
            }}
          >
            <Volume2 className="size-4" /> Tap for sound
          </button>
        )}
        <button
          className="splash-sound-btn"
          onClick={toggleSound}
          aria-label={soundOn ? 'Turn intro sound off' : 'Turn intro sound on'}
          title={soundOn ? 'Sound on' : 'Sound off'}
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>
    </div>
  )
}
