// TEMPORARY probe — verifies the API_FOOTBALL_KEY secret works and reports
// what the current plan returns (season limits matter on the free tier).
// Removed after we read the CI logs.
import { fetchApiFootball, enrich } from './adapters/apifootball'

const KEY = process.env.API_FOOTBALL_KEY || ''
const BASE = 'https://v3.football.api-sports.io'

async function status() {
  const res = await fetch(`${BASE}/status`, { headers: { 'x-apisports-key': KEY } })
  console.log('status HTTP', res.status)
  console.log(JSON.stringify((await res.json())?.response ?? {}, null, 0))
}

async function day(label: string, dateDash: string) {
  const r = await fetchApiFootball(dateDash)
  const fin = r.filter((x) => x.status === 'finished')
  console.log(`\n[${label}] ${dateDash}: ${r.length} fixtures, ${fin.length} finished`)
  for (const g of fin.slice(0, 3)) console.log(`  ${g.home} ${g.homeScore}-${g.awayScore} ${g.away} (id=${g.providerId})`)
  return fin
}

async function main() {
  console.log('key present:', !!KEY)
  await status()
  await day('2023', '2023-04-01')
  const recent = await day('2026-recent', '2026-07-05')
  const sample = (recent[0] ?? (await day('2023-again', '2023-04-01'))[0])
  if (sample) {
    const e = await enrich(sample)
    console.log('\nenriched sample:', JSON.stringify({
      match: `${e.home} v ${e.away}`,
      corners: [e.homeCorners, e.awayCorners],
      cards: [e.homeCards, e.awayCards],
      scorers: e.scorers,
    }))
  }
}
main().catch((err) => { console.error('probe error:', err.message); process.exit(1) })
