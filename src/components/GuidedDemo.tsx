import { useEffect, useRef } from 'react'
import { demoLines, demoTrack } from '../data/demo'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { LyricsPlayer } from './LyricsPlayer'

export function GuidedDemo() {
  const player = useAudioPlayer(demoTrack.audioSrc, demoTrack.durationMs)
  const section = useRef<HTMLElement>(null)
  const reveal = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = section.current
    if (!el || !reveal.current) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const update = () => {
      frame = 0
      const top = reveal.current!.getBoundingClientRect().top
      const range = Math.min(250, window.innerHeight * 0.32)
      const progress = reduced.matches
        ? 1
        : Math.max(0, Math.min(1, (window.innerHeight - top - 35) / range))
      el.style.setProperty('--demo-progress', String(progress))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const resize = new ResizeObserver(schedule)
    resize.observe(el.parentElement!)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    reduced.addEventListener('change', schedule)
    update()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      reduced.removeEventListener('change', schedule)
    }
  }, [])
  return (
    <section className="demo-section" id="demo" ref={section} aria-labelledby="demo-title">
      <div className="demo-heading">
        <div>
          <span className="eyebrow">TRY IT HERE</span>
          <h2 id="demo-title">A song to get you started.</h2>
        </div>
        <span className="demo-badge">Interactive demo · sound on play</span>
      </div>
      <audio
        ref={player.audioRef}
        src={demoTrack.audioSrc}
        preload="none"
        aria-label="Gharibe Ashena demo audio"
      />
      <div ref={reveal} className="demo-reveal">
        <div className="demo-content">
          <LyricsPlayer
            track={demoTrack}
            lines={demoLines}
            player={player}
            modeLabel="Demo"
            guided
          />
        </div>
      </div>
      <p className="demo-source">
        Googoosh · Gharibe Ashena{' '}
        <span>
          Timing:{' '}
          <a href="https://lrclib.net" target="_blank" rel="noreferrer">
            LRCLIB
          </a>{' '}
          · Finglish prepared for this demo
        </span>
      </p>
    </section>
  )
}
