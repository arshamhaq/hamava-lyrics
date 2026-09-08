import { useState, type CSSProperties } from 'react'
import { MoveHorizontal } from 'lucide-react'

// A supplied phrase, rendered locally. This is a script comparison, not inference.
export function ScriptLens() {
  const [reveal, setReveal] = useState(48)
  return (
    <div className="script-lens" style={{ '--reveal': `${reveal}%` } as CSSProperties}>
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
          aria-valuetext={`${reveal}% Finglish revealed`}
          type="range"
          min="0"
          max="100"
          value={reveal}
          onChange={(event) => setReveal(Number(event.target.value))}
        />
      </div>
      <p className="lens-control">Slide between scripts</p>
      <span className="sr-only">دوستت دارم — Doostet Daram</span>
    </div>
  )
}
