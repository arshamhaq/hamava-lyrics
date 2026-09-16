import { useEffect, useRef, useState, type RefObject } from 'react'
import { Check, Copy } from 'lucide-react'
export interface ReadingLine {
  id: string
  persian: string
  finglish: string
  error?: string
}
interface Props {
  lines: readonly ReadingLine[]
  persian: boolean
  activeId?: string
  currentRow?: RefObject<HTMLDivElement | null>
  onInteract?: () => void
  onMessage: (message: string) => void
  prefix: string
}
// Shared by the full-window and unsynced readers. Missing conversion stays readable.
export function LyricRows({
  lines,
  persian,
  activeId,
  currentRow,
  onInteract,
  onMessage,
  prefix,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const requestId = useRef(0)
  useEffect(() => {
    if (!copiedId) return
    const timer = setTimeout(() => setCopiedId(null), 2000)
    return () => clearTimeout(timer)
  }, [copiedId])
  useEffect(
    () => () => {
      requestId.current++
    },
    [],
  )
  async function copy(line: ReadingLine, index: number) {
    const id = ++requestId.current
    setCopiedId(null)
    try {
      await navigator.clipboard.writeText(line.finglish)
      if (id !== requestId.current) return
      setCopiedId(line.id)
      onMessage(`Line ${index + 1} copied.`)
    } catch {
      if (id === requestId.current)
        onMessage('Copy is unavailable. Select the text and copy it manually.')
    }
  }
  return lines
    .filter((line) => line.persian || line.finglish)
    .map((line, index) => (
      <div
        key={line.id}
        ref={line.id === activeId ? currentRow : undefined}
        className="full-lyric"
        aria-current={line.id === activeId ? 'true' : undefined}
      >
        <div className="full-lyric-text">
          <span
            id={`${prefix}-line-${line.id}`}
            lang={line.finglish ? 'fa-Latn' : 'fa'}
            dir={line.finglish ? undefined : 'rtl'}
          >
            {line.finglish || line.persian}
          </span>
          {line.error && (
            <span className="lyric-conversion-error">
              Finglish unavailable for this line · original kept
            </span>
          )}
          {persian && line.persian && line.finglish && (
            <span className="full-persian-line" lang="fa" dir="rtl">
              {line.persian}
            </span>
          )}
        </div>
        <button
          className="full-line-copy"
          aria-label={`Copy line ${index + 1}`}
          aria-describedby={`${prefix}-line-${line.id}`}
          title={
            line.finglish
              ? copiedId === line.id
                ? 'Copied!'
                : 'Copy this line'
              : line.error || 'Finglish is not ready yet'
          }
          disabled={!line.finglish}
          data-copied={copiedId === line.id}
          onFocus={onInteract}
          onClick={() => copy(line, index)}
        >
          {copiedId === line.id ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
    ))
}
