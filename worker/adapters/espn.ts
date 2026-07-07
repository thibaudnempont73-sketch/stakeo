// ESPN adapter (no API key). Fetches a league's scoreboard for a date and
// normalizes each game into the engine's `MatchResult`. Runs server-side
// (cron / GitHub Actions), never in the browser.
import type { MatchResult } from '../../src/lib/settle'

// App sport → ESPN sport path. Soccer needs a league code (eng.1, esp.1, …);
// "all" aggregates the major ones.
export const ESPN_SPORT: Record<string, string> = {
  basketball: 'basketball/nba',
  amfootball: 'football/nfl',
  baseball: 'baseball/mlb',
  hockey: 'hockey/nhl',
  football: 'soccer/all',
}

function normStatus(name: string | undefined): MatchResult['status'] {
  if (name === 'STATUS_FINAL' || name === 'STATUS_FULL_TIME') return 'finished'
  if (name === 'STATUS_POSTPONED') return 'postponed'
  if (name === 'STATUS_CANCELED' || name === 'STATUS_CANCELLED') return 'cancelled'
  if (name === 'STATUS_SCHEDULED') return 'in_progress'
  return 'in_progress'
}

/** Fetch and normalize one league's games for a given YYYYMMDD date. */
export async function fetchEspn(sportPath: string, dateYYYYMMDD: string): Promise<MatchResult[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${dateYYYYMMDD}`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${sportPath} ${dateYYYYMMDD}`)
  const data: any = await res.json()
  const out: MatchResult[] = []
  for (const e of data.events ?? []) {
    const comp = e.competitions?.[0]
    if (!comp?.competitors) continue
    const home = comp.competitors.find((c: any) => c.homeAway === 'home')
    const away = comp.competitors.find((c: any) => c.homeAway === 'away')
    if (!home || !away) continue
    out.push({
      home: home.team?.displayName ?? home.team?.name ?? '',
      away: away.team?.displayName ?? away.team?.name ?? '',
      homeScore: Number(home.score ?? 0),
      awayScore: Number(away.score ?? 0),
      status: normStatus(comp.status?.type?.name),
    })
  }
  return out
}

function norm(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/** Find the game matching a bet's event text ("Memphis – Minnesota") in a list. */
export function matchFixture(eventText: string, results: MatchResult[]): MatchResult | null {
  const parts = norm(eventText)
    .split(/ - | – | — | vs | @ /)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3)
  if (parts.length < 2) return null
  for (const r of results) {
    const teams = [norm(r.home), norm(r.away)]
    const allFound = parts.every((p) => teams.some((t) => t.includes(p) || p.includes(t)))
    if (allFound) return r
  }
  return null
}
