import type { LyricLine } from '../lib/timeline'

// Only the excerpt supplied by the project owner in the planning conversation.
// Times are synthetic for an interactive UI preview, not real recording timing.
export const demoTrack = {
  title: 'Gharibe Ashena',
  artist: 'Googoosh',
  durationMs: 24_000,
  source: 'Owner-provided excerpt · simulated timing',
}

export const demoLines: readonly LyricLine[] = [
  { id: 'demo-1', startMs: 0, endMs: 8_000, finglish: 'Gharibe Ashena', persian: 'غریب آشنا' },
  { id: 'demo-2', startMs: 8_000, endMs: 16_000, finglish: 'Doostet Daram', persian: 'دوستت دارم' },
  { id: 'demo-3', startMs: 16_000, endMs: 24_000, finglish: 'Bia', persian: 'بیا' },
]
