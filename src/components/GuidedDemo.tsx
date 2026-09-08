import { useEffect, useRef } from 'react'
import { demoLines, demoTrack } from '../data/demo'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import { LyricsPlayer } from './LyricsPlayer'

export function GuidedDemo() {
  const player = useAudioPlayer(demoTrack.audioSrc, demoTrack.durationMs)
  const section = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = section.current
    if (!el || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.classList.add('demo-revealed')
          observer.disconnect()
        }
      },
      { rootMargin: '0px 0px -45px 0px', threshold: 0.08 },
    )
    observer.observe(el)
    return () => observer.disconnect()
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
      <LyricsPlayer track={demoTrack} lines={demoLines} player={player} modeLabel="Demo" guided />
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
