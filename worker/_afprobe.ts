// TEMPORARY probe — inspect raw API-Football responses (errors / results).
import { enrich } from './adapters/apifootball'

const KEY = process.env.API_FOOTBALL_KEY || ''
const BASE = 'https://v3.football.api-sports.io'

async function raw(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } })
  const j: any = await res.json()
  console.log(`\nGET ${path} -> HTTP ${res.status}`)
  console.log('  errors:', JSON.stringify(j?.errors ?? {}))
  console.log('  results:', j?.results, '| paging:', JSON.stringify(j?.paging ?? {}))
  return j
}

async function main() {
  await raw('/fixtures?date=2023-04-01')
  await raw('/fixtures?league=39&season=2023')
  const j = await raw('/fixtures?league=39&season=2023&from=2023-04-01&to=2023-04-08')
  const first = (j?.response ?? [])[0]
  if (first) {
    const id = String(first.fixture?.id)
    console.log('  sample fixture:', first.teams?.home?.name, 'v', first.teams?.away?.name, `(id=${id}, ${first.fixture?.status?.short})`)
    const e = await enrich({
      home: first.teams?.home?.name, away: first.teams?.away?.name,
      homeScore: first.goals?.home ?? 0, awayScore: first.goals?.away ?? 0,
      status: 'finished', provider: 'apifootball', providerId: id,
    })
    console.log('  enriched:', JSON.stringify({ corners: [e.homeCorners, e.awayCorners], cards: [e.homeCards, e.awayCards], scorers: e.scorers }))
  }
  await raw('/fixtures?date=2024-04-06')
  await raw('/fixtures?date=2025-04-05')
}
main().catch((err) => { console.error('probe error:', err.message); process.exit(1) })
