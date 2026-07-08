// TEMPORARY probe — exercise the exotic pipeline on a current-window fixture.
import { fetchApiFootball, enrich } from './adapters/apifootball'

async function main() {
  for (const d of ['2026-07-07', '2026-07-08']) {
    const r = await fetchApiFootball(d)
    const fin = r.filter((x) => x.status === 'finished')
    console.log(`\n[${d}] ${r.length} fixtures, ${fin.length} finished`)
    for (const g of fin.slice(0, 4)) console.log(`  ${g.home} ${g.homeScore}-${g.awayScore} ${g.away} (id=${g.providerId})`)
    const sample = fin.find((x) => x.homeScore + x.awayScore > 0) || fin[0]
    if (sample) {
      const e = await enrich(sample)
      console.log('  ENRICHED', `${e.home} v ${e.away}:`, JSON.stringify({
        corners: [e.homeCorners, e.awayCorners],
        cards: [e.homeCards, e.awayCards],
        scorers: e.scorers,
        players: Object.keys(e.players ?? {}).length,
      }))
      break
    }
  }
}
main().catch((err) => { console.error('probe error:', err.message); process.exit(1) })
