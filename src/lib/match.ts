// Team-name normalization + fuzzy fixture matching. Pure (no I/O), shared by
// the settlement worker (server) and the app's instant cache settlement.
import type { MatchResult } from './settle'

/** Lowercase, strip accents and collapse whitespace for loose comparison. */
export function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split "Memphis – Minnesota" / "PSG vs OM" into its two team names. */
export function splitEvent(eventText: string): string[] {
  return norm(eventText)
    .split(/ - | – | — | vs | v | @ | : /)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
}

// Generic words that carry no identifying signal — dropped before comparison.
const STOP = new Set(['the', 'fc', 'cf', 'sc', 'ac', 'as', 'club', 'de', 'of', 'and'])

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
}

// A bet's team name matches a fixture team when every significant token of the
// bet side has a prefix-compatible token on that side — so "Man City" lines up
// with "Manchester City" and "Memphis" with "Memphis Grizzlies".
function teamMatches(part: string, teamName: string): boolean {
  const p = tokens(part)
  const t = tokens(teamName)
  if (!p.length || !t.length) return false
  return p.every((pt) => t.some((tt) => tt === pt || tt.startsWith(pt) || pt.startsWith(tt)))
}

// True when a team name appears inside a free-text selection — every
// significant token of the team has a prefix-compatible token in the text.
// Handles bookmaker abbreviations: "Man City" ⊂ "Man City wins" → Manchester
// City, "Rays" ⊂ "Tampa Bay Rays remporte" → Tampa Bay Rays.
export function teamInText(team: string, text: string): boolean {
  const tt = tokens(team)
  const xt = tokens(text)
  if (!tt.length || !xt.length) return false
  const compat = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a)
  const subset = (small: string[], big: string[]) => small.every((k) => big.some((w) => compat(k, w)))
  // Either direction: full team name inside a longer selection ("Man City
  // wins"), or a short nickname that is part of the team ("Rays").
  return subset(tt, xt) || subset(xt, tt)
}

/** Find the game matching a bet's event text ("Memphis – Minnesota") in a list. */
export function matchFixture(eventText: string, results: MatchResult[]): MatchResult | null {
  const parts = splitEvent(eventText)
  if (parts.length < 2) return null
  const [a, b] = parts
  for (const r of results) {
    const aHome = teamMatches(a, r.home)
    const aAway = teamMatches(a, r.away)
    const bHome = teamMatches(b, r.home)
    const bAway = teamMatches(b, r.away)
    // Each side must map to a different team (a→home & b→away, or the reverse).
    if ((aHome && bAway) || (aAway && bHome)) return r
  }
  return null
}
