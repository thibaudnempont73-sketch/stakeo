// TheSportsDB adapter (no API key — the public free test key "3").
// One call returns every league's finished games for a sport on a given day,
// so it broadens coverage well beyond the handful of ESPN leagues (worldwide
// football, plus handball / volleyball / rugby that ESPN doesn't expose).
// Best-effort: any error or rate-limit just yields [] and the worker falls
// back to its other sources.
import type { MatchResult } from '../../src/lib/settle'

// App sport → TheSportsDB "sport" name used by eventsday.php?s=…
export const SPORTSDB_SPORT: Record<string, string> = {
  football: 'Soccer',
  basketball: 'Basketball',
  hockey: 'Ice Hockey',
  baseball: 'Baseball',
  amfootball: 'American Football',
  rugby: 'Rugby',
  handball: 'Handball',
  volleyball: 'Volleyball',
}

const FINISHED = new Set(['match finished', 'ft', 'aet', 'ap', 'aot', 'final', 'finished', 'fin'])

function normStatus(strStatus: string | undefined): MatchResult['status'] {
  const s = (strStatus || '').toLowerCase().trim()
  if (FINISHED.has(s)) return 'finished'
  if (s.includes('postpon')) return 'postponed'
  if (s.includes('cancel') || s.includes('abandon')) return 'cancelled'
  return 'in_progress'
}

/** Fetch a sport's games for a date (YYYY-MM-DD) from TheSportsDB. */
export async function fetchSportsDb(sportName: string, dateDash: string): Promise<MatchResult[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${dateDash}&s=${encodeURIComponent(sportName)}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`SportsDB ${res.status} for ${sportName} ${dateDash}`)
  const data: any = await res.json()
  const out: MatchResult[] = []
  for (const e of data.events ?? []) {
    const home = e.strHomeTeam
    const away = e.strAwayTeam
    if (!home || !away) continue
    const hs = e.intHomeScore
    const as = e.intAwayScore
    out.push({
      home,
      away,
      homeScore: hs == null || hs === '' ? 0 : Number(hs),
      awayScore: as == null || as === '' ? 0 : Number(as),
      status: normStatus(e.strStatus),
    })
  }
  return out
}
