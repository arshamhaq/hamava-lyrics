import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { MoveHorizontal, Pause, Play } from 'lucide-react'

// Supplied phrase: a local script comparison, not inference.
export function ScriptLens() {
  const [reveal, setReveal] = useState(48)
  const [automatic, setAutomatic] = useState(
    () => !matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const card = useRef<HTMLDivElement>(null)
  const phase = useRef(0)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const changed = () => {
      if (reduced.matches) setAutomatic(false)
    }
    reduced.addEventListener('change', changed)
    return () => reduced.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    if (!automatic || !card.current) return
    let frame = 0,
      last = 0,
      lastPaint = 0,
      visible = false
    const tick = (now: number) => {
      phase.current += last ? now - last : 0
      last = now
      if (now - lastPaint > 32) {
        // One 2.5-second pass: reveal Persian, then finish on Finglish.
        const progress = Math.min(1, phase.current / 2500)
        const leg = progress < 0.3 ? progress / 0.3 : (progress - 0.3) / 0.7
        const eased = (1 - Math.cos(Math.PI * leg)) / 2
        setReveal(progress < 0.3 ? 48 * (1 - eased) : 100 * eased)
        lastPaint = now
      }
      if (phase.current >= 2500) {
        setReveal(100)
        setAutomatic(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(frame)
      last = 0
      if (visible && document.visibilityState === 'visible') frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting
      resume()
    })
    observer.observe(card.current)
    document.addEventListener('visibilitychange', resume)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', resume)
    }
  }, [automatic])
  return (
    <div ref={card} className="script-lens" style={{ '--reveal': `${reveal}%` } as CSSProperties}>
      <p className="lens-example-label">
        <span className="lens-description">A glimpse of Finglish</span>
        <span className="lens-example-badge">Example only</span>
      </p>
      <div className="lens-caption">
        <span>Finglish</span>
        <span>Persian</span>
      </div>
      <div className="lens-window">
        <div className="lens-script lens-persian" aria-hidden="true">
          <span lang="fa" dir="rtl">
            دوستت دارم
          </span>
        </div>
        <div className="lens-script lens-finglish" aria-hidden="true">
          <span lang="fa-Latn">Doostet Daram</span>
        </div>
        <div className="lens-seam" aria-hidden="true">
          <span>
            <MoveHorizontal size={16} />
          </span>
        </div>
        <input
          aria-label="Reveal Finglish"
          aria-valuetext={`${Math.round(reveal)}% Finglish revealed`}
          type="range"
          min="0"
          max="100"
          value={reveal}
          onPointerDown={() => setAutomatic(false)}
          onFocus={() => setAutomatic(false)}
          onChange={(event) => {
            setAutomatic(false)
            setReveal(Number(event.target.value))
          }}
        />
      </div>
      <div className="lens-footer">
        <p className="lens-control">One phrase, two scripts.</p>
        <button
          className="lens-animation-control"
          onClick={() => {
            if (automatic) setAutomatic(false)
            else {
              phase.current = 0
              setReveal(48)
              setAutomatic(true)
            }
          }}
          aria-label={automatic ? 'Pause card animation' : 'Replay card animation'}
        >
          {automatic ? <Pause size={12} /> : <Play size={12} />}
          <span>{automatic ? 'Pause' : 'Replay'}</span>
        </button>
      </div>
      <span className="sr-only">دوستت دارم — Doostet Daram</span>
    </div>
  )
}
