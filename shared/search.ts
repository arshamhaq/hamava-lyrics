export type Provider = 'lrclib' | 'ovh'
export interface SongHit {
  provider: Provider
  id: string
  title: string
  artist: string
  album: string
  duration: number | null
  hasLyrics: boolean
}
export interface SearchResult {
  songs: SongHit[]
  notice?: string
}
export interface SongText {
  title: string
  artist: string
  album: string
  duration: number | null
  text: string
  source: string
  sourceUrl: string
}
export const normalizeQuery = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200d]/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const aliases: [RegExp, string][] = [
  [/دل\s*بردی|delbordi/g, 'del bordi'],
  [/غریب\s*[اآ]شنا/g, 'gharibe ashena'],
  [/گوگوش/g, 'googoosh'],
  [/محمد\s*رضا\s*شجریان|محمدرضا\s*شجریان|شجریان/g, 'shajarian'],
  [/همایون/g, 'homayoun'],
  [/شادمهر(?:\s*عقیلی)?/g, 'shadmehr aghili'],
  [/محسن\s*چاوشی/g, 'mohsen chavoshi'],
  [/ابی/g, 'ebi'],
  [/داریوش/g, 'dariush'],
  [/هایده/g, 'hayedeh'],
  [/مهستی/g, 'mahasti'],
]
export function aliasQuery(input: string): string {
  let alias = normalizeQuery(input)
  for (const [pattern, replacement] of aliases) alias = alias.replace(pattern, replacement)
  return alias
    .replace(/\b(tasnim|tasnif|tasnife)\b|تصنیف/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
export function queryVariants(input: string): string[] {
  const q = normalizeQuery(input)
  const alias = aliasQuery(q)
  const variants = [q, alias]
  // A bounded broad search retrieves candidates to rank locally, not an exact title lookup.
  const tokens = (alias || q).split(' ').filter((t) => t.length >= 3)
  if (tokens.length > 1)
    variants.push(...[...tokens].sort((a, b) => b.length - a.length).slice(0, 2))
  else variants.push(q.replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a'))
  return [...new Set(variants)].filter((v) => v.length >= 2).slice(0, 3)
}
const fold = (s: string) => s.replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a')
function close(a: string, b: string) {
  a = fold(a)
  b = fold(b)
  if (a === b || (a.length >= 4 && b.startsWith(a) && b.length - a.length <= 2)) return true
  const limit = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0
  if (!limit || Math.abs(a.length - b.length) > limit) return false
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]))
    row = next
  }
  return row[b.length] <= limit
}
export function matchScore(hit: SongHit, input: string) {
  const title = normalizeQuery(hit.title)
  const fields = normalizeQuery(`${hit.title} ${hit.artist}`).split(' ')
  // Broad fallback tokens must never replace the user's full query for ranking.
  const variants = [...new Set([normalizeQuery(input), aliasQuery(input)])].filter(Boolean)
  return Math.max(
    ...variants.map((q) => {
      const tokens = q.split(' ')
      const matched = tokens.filter((t) => fields.some((w) => close(t, w))).length
      if (matched / tokens.length < 0.75) return 0
      return (
        (matched / tokens.length) * 10 +
        Number(title.includes(q)) * 3 +
        Number(title === q) * 2 +
        Number(hit.hasLyrics)
      )
    }),
  )
}
export function rankSongs(hits: SongHit[], query: string) {
  const unique = [...new Map(hits.map((h) => [`${h.provider}:${h.id}`, h])).values()]
  return unique
    .map((hit) => ({ hit, score: matchScore(hit, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((x) => x.hit)
}
