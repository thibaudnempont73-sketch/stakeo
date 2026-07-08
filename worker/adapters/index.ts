// Aggregates every no-key score source for a sport into one normalized,
// deduped result list, cached per (sport, date) for the whole worker run.
// Add a new free adapter here and every consumer picks it up automatically.
import type { MatchResult } from '../../src/lib/settle'
import { fetchEspn, ESPN_LEAGUES } from './espn'
import { fetchSportsDb, SPORTSDB_SPORT } from './thesportsdb'
import { fetchApiFootball, enrich as enrichAf, hasApiFootball } from './apifootball'
import { norm } from './match'

export { matchFixture } from './match'

/** True when at least one structured source covers this sport. */
export function hasFreeCoverage(sport: string): boolean {
  return (ESPN_LEAGUES[sport]?.length ?? 0) > 0 || !!SPORTSDB_SPORT[sport]
}

/** Pull exotic data (corners/cards/scorers) for the single matched fixture. */
export function enrichFixture(result: MatchResult): Promise<MatchResult> {
  return enrichAf(result)
}

function dash(ymd: string): string {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`
}

// Prefer the entry that's actually finished when two sources report the same
// game (one may still say "in_progress" while the other has the final score).
// Whichever wins, keep an API-Football provider id if any source carried one,
// so the fixture stays enrichable with exotic data.
function dedupe(results: MatchResult[]): MatchResult[] {
  const by = new Map<string, MatchResult>()
  for (const r of results) {
    const key = [norm(r.home), norm(r.away)].sort().join('|')
    const prev = by.get(key)
    if (!prev) {
      by.set(key, r)
      continue
    }
    const winner = prev.status !== 'finished' && r.status === 'finished' ? r : prev
    const withId =
      winner.providerId
        ? winner
        : { ...winner, provider: r.provider ?? prev.provider, providerId: r.providerId ?? prev.providerId }
    by.set(key, withId)
  }
  return [...by.values()]
}

const cache = new Map<string, Promise<MatchResult[]>>()

/** All free-source games for `sport` on a YYYYMMDD date (cached, deduped). */
export function fetchResults(sport: string, ymd: string): Promise<MatchResult[]> {
  const key = `${sport}:${ymd}`
  if (!cache.has(key)) cache.set(key, load(sport, ymd))
  return cache.get(key)!
}

async function load(sport: string, ymd: string): Promise<MatchResult[]> {
  const jobs: Promise<MatchResult[]>[] = []
  // API-Football first so its fixtures (with ids for exotic enrichment) win.
  if (sport === 'football' && hasApiFootball()) {
    jobs.push(fetchApiFootball(dash(ymd)).catch(() => [] as MatchResult[]))
  }
  for (const league of ESPN_LEAGUES[sport] ?? []) {
    jobs.push(fetchEspn(league, ymd).catch(() => [] as MatchResult[]))
  }
  const sdb = SPORTSDB_SPORT[sport]
  if (sdb) jobs.push(fetchSportsDb(sdb, dash(ymd)).catch(() => [] as MatchResult[]))
  const all = (await Promise.all(jobs)).flat()
  return dedupe(all)
}
