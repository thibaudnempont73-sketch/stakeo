// ESPN adapter (no API key). Fetches a league scoreboard for a date and
// normalizes each game into the engine's `MatchResult`. Runs server-side
// (cron / GitHub Actions), never in the browser.
//
// ESPN exposes one scoreboard per league, so each app sport maps to the list
// of ESPN leagues we want to cover for it.
import type { MatchResult } from '../../src/lib/settle'

export const ESPN_LEAGUES: Record<string, string[]> = {
  football: [
    'soccer/eng.1', // Premier League
    'soccer/esp.1', // LaLiga
    'soccer/ita.1', // Serie A
    'soccer/ger.1', // Bundesliga
    'soccer/fra.1', // Ligue 1
    'soccer/por.1', // Primeira Liga
    'soccer/ned.1', // Eredivisie
    'soccer/bel.1', // Jupiler Pro League
    'soccer/tur.1', // Süper Lig
    'soccer/eng.2', // Championship
    'soccer/esp.2', // LaLiga 2
    'soccer/ita.2', // Serie B
    'soccer/ger.2', // 2. Bundesliga
    'soccer/fra.2', // Ligue 2
    'soccer/uefa.champions', // Champions League
    'soccer/uefa.europa', // Europa League
    'soccer/uefa.europa.conf', // Conference League
    'soccer/eng.fa', // FA Cup
    'soccer/usa.1', // MLS
    'soccer/mex.1', // Liga MX
    'soccer/bra.1', // Brasileirão
    'soccer/arg.1', // Liga Profesional
    'soccer/sau.1', // Saudi Pro League
  ],
  basketball: [
    'basketball/nba',
    'basketball/wnba',
    'basketball/mens-college-basketball',
  ],
  amfootball: [
    'football/nfl',
    'football/college-football',
  ],
  baseball: ['baseball/mlb'],
  hockey: ['hockey/nhl'],
}

function normStatus(name: string | undefined): MatchResult['status'] {
  if (name === 'STATUS_FINAL' || name === 'STATUS_FULL_TIME') return 'finished'
  if (name === 'STATUS_POSTPONED') return 'postponed'
  if (name === 'STATUS_CANCELED' || name === 'STATUS_CANCELLED') return 'cancelled'
  if (name === 'STATUS_SCHEDULED') return 'in_progress'
  return 'in_progress'
}

/** Fetch and normalize one ESPN league's games for a given YYYYMMDD date. */
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
