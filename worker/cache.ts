// Persist finished matches into the shared cache (fixtures + results) so the
// app can settle bets instantly and no match is ever re-fetched. Writes use
// the worker's service_role client (bypasses RLS). Best-effort.
import type { MatchResult } from '../src/lib/settle'
import { matchKey, ymdOf, packResult } from '../src/lib/results'

export interface CacheEntry {
  sport: string
  startsAt: string // ISO
  mr: MatchResult
}

export async function flushCache(sb: any, entries: CacheEntry[]): Promise<void> {
  if (!entries.length) return
  const fixtures: any[] = []
  const results: any[] = []
  for (const e of entries) {
    const id = matchKey(e.sport, ymdOf(e.startsAt), e.mr.home, e.mr.away)
    fixtures.push({
      id,
      sport: e.sport,
      home: e.mr.home,
      away: e.mr.away,
      event: `${e.mr.home} - ${e.mr.away}`,
      starts_at: e.startsAt,
      source: e.mr.provider ?? null,
    })
    results.push({
      fixture_id: id,
      status: e.mr.status,
      home_score: e.mr.homeScore,
      away_score: e.mr.awayScore,
      data: packResult(e.mr),
      source: e.mr.provider ?? null,
    })
  }
  const f = await sb.from('fixtures').upsert(fixtures)
  if (f.error) throw f.error
  const r = await sb.from('results').upsert(results)
  if (r.error) throw r.error
}
