// App-side read of the shared results cache (populated server-side by the
// settlement worker). Authenticated-read only, protected by RLS. No writes,
// no external APIs — purely reads finished games to settle bets instantly.
import { supabase } from './supabase'
import { rowToResult } from './results'
import type { MatchResult } from './settle'

/** Finished cached games for a sport within an ISO time window. */
export async function fetchCachedResults(sport: string, fromISO: string, toISO: string): Promise<MatchResult[]> {
  if (!supabase) return []
  const fx = await supabase
    .from('fixtures')
    .select('id,home,away,starts_at')
    .eq('sport', sport)
    .gte('starts_at', fromISO)
    .lte('starts_at', toISO)
  if (fx.error) throw fx.error
  const rows = fx.data ?? []
  if (!rows.length) return []

  const ids = rows.map((r) => r.id)
  const rs = await supabase.from('results').select('*').in('fixture_id', ids).eq('status', 'finished')
  if (rs.error) throw rs.error

  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: MatchResult[] = []
  for (const r of rs.data ?? []) {
    const fxRow = byId.get(r.fixture_id)
    if (fxRow) out.push(rowToResult(fxRow, r))
  }
  return out
}
