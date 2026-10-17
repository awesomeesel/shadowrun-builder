import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * A sticky row of section names for long pages: tap one to scroll to it. It
 * finds the page's sections itself, so sections that come and go (like Magic)
 * show up without any wiring.
 */
export function JumpMenu({ container }: { container: RefObject<HTMLElement | null> }) {
  const [sections, setSections] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const nav = useRef<HTMLElement>(null)
  /** Keep the tapped section highlighted until the page has finished scrolling there. */
  const pinned = useRef(false)

  useEffect(() => {
    const root = container.current
    if (!root) return
    const read = () => {
      const titles = [...root.querySelectorAll<HTMLElement>('section[data-jump]')].map((s) => s.dataset.jump ?? '')
      setSections((old) => (old.join('|') === titles.join('|') ? old : titles))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [container])

  // Highlight the section the reader is in: the last one whose top has scrolled past the menu.
  useEffect(() => {
    const root = container.current
    if (!root) return
    const onScroll = () => {
      if (pinned.current) return
      // Below the sticky header and this menu, with some room for the section's title.
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 90
      const offset = header + (nav.current?.offsetHeight ?? 50) + 40
      let active: string | null = null
      for (const s of root.querySelectorAll<HTMLElement>('section[data-jump]')) {
        if (s.getBoundingClientRect().top <= offset) active = s.dataset.jump ?? null
      }
      // At the very bottom the last sections can't reach the top, so the last one counts as current.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const all = root.querySelectorAll<HTMLElement>('section[data-jump]')
      setCurrent(atBottom && all.length ? (all[all.length - 1].dataset.jump ?? active) : active)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [container])

  // Keep the highlighted name visible in the row.
  useEffect(() => {
    const chip = [...(nav.current?.querySelectorAll<HTMLElement>('button') ?? [])].find(
      (b) => b.textContent === current,
    )
    // Scroll only the row sideways; scrollIntoView could interrupt the page's own smooth scroll.
    if (chip && nav.current) {
      nav.current.scrollTo({
        left: chip.offsetLeft - nav.current.clientWidth / 2 + chip.offsetWidth / 2,
        behavior: 'smooth',
      })
    }
  }, [current])

  const jump = (title: string) => {
    const target = [...(container.current?.querySelectorAll<HTMLElement>('section[data-jump]') ?? [])].find(
      (s) => s.dataset.jump === title,
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Sections near the bottom can't reach the top of the screen, so remember the choice for a moment.
    setCurrent(title)
    pinned.current = true
    const release = () => {
      pinned.current = false
      window.removeEventListener('scrollend', release)
    }
    window.addEventListener('scrollend', release)
    setTimeout(release, 3000) // Browsers without scrollend, or when there was nothing to scroll.
  }

  if (sections.length < 4) return null
  return (
    <nav
      ref={nav}
      aria-label="Jump to section"
      className="no-scrollbar sticky top-[var(--header-h,5.6rem)] z-[5] -mx-4 mb-4 flex gap-1.5 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border"
    >
      {sections.map((title) => (
        <button
          key={title}
          onClick={() => jump(title)}
          className={`chip shrink-0 cursor-pointer whitespace-nowrap ${
            current === title ? 'border-accent bg-accent/15 text-accent' : 'text-muted hover:text-fg'
          }`}
        >
          {title}
        </button>
      ))}
    </nav>
  )
}
