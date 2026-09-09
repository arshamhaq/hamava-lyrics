import { useLayoutEffect, useRef, type RefObject } from 'react'

// Each note appears once per mounted demo, after its parent reveal and when
// it reaches the viewport. Hiding/showing tips does not replay seen notes.
export function useGuideEntrance(
  root: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  ready: boolean,
) {
  const seen = useRef(new Set<string>())
  useLayoutEffect(() => {
    const el = root.current
    if (!el || !enabled) return
    const notes = Array.from(el.querySelectorAll<HTMLElement>('[data-guide]'))
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const show = (note: HTMLElement, animate: boolean) => {
      seen.current.add(note.dataset.guide!)
      note.dataset.entrance = animate ? 'drawing' : 'done'
    }
    const prepare = () => {
      observer?.disconnect()
      if (reduced.matches || !('IntersectionObserver' in window)) {
        notes.forEach((note) => show(note, false))
        return
      }
      notes.forEach((note) => {
        note.dataset.entrance = seen.current.has(note.dataset.guide!) ? 'done' : 'waiting'
      })
      if (!ready) return
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const note = entry.target as HTMLElement
            if (!seen.current.has(note.dataset.guide!)) show(note, true)
            observer?.unobserve(note)
          })
        },
        { threshold: 0.25 },
      )
      notes
        .filter((note) => !seen.current.has(note.dataset.guide!))
        .forEach((note) => observer!.observe(note))
    }
    const complete = (event: AnimationEvent) => {
      if (event.animationName !== 'guide-words') return
      const note = (event.target as HTMLElement).closest<HTMLElement>('[data-guide]')
      if (note) note.dataset.entrance = 'done'
    }
    prepare()
    reduced.addEventListener('change', prepare)
    el.addEventListener('animationend', complete)
    return () => {
      observer?.disconnect()
      reduced.removeEventListener('change', prepare)
      el.removeEventListener('animationend', complete)
    }
  }, [root, enabled, ready])
}
