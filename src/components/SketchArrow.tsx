export function SketchArrow({
  kind = 'curl',
  mirror = false,
}: {
  kind?: 'curl' | 'swoop'
  mirror?: boolean
}) {
  return (
    <svg
      className={`sketch-arrow ${mirror ? 'sketch-mirrored' : ''}`}
      viewBox="0 0 120 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'curl' ? (
        <>
          <path d="M105 86C79 89 54 78 58 62c4-17 30-13 30 0 0 18-48 13-54-12-3-13-2-25 2-39" />
          <path d="M23 24c5-4 10-12 13-16 1 8 6 16 11 20" />
        </>
      ) : (
        <>
          <path d="M109 87C75 92 44 73 35 49c-5-13-5-25-1-38" />
          <path d="M20 26C26 20 31 12 35 8c1 8 6 17 12 21" />
        </>
      )}
    </svg>
  )
}
