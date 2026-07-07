// End-to-end demo: fetch real ESPN scores → settle a real bet with the engine.
// Run: npx tsx worker/demo-settle.ts
import { fetchEspn, matchFixture } from './adapters/espn'
import { settleMarket, type Outcome } from '../src/lib/settle'

// The user's real Winamax combo (from the shared bet slip).
const bet = {
  bookmaker: 'Winamax',
  sport: 'basketball',
  stake: 15,
  odds: 1.9,
  date: '2022-04-26', // NBA games (Europe showed 27/04 due to timezone)
  legs: [
    { event: 'Memphis Grizzlies – Minnesota Timberwolves', market: 'Vainqueur Memphis Grizzlies' },
    { event: 'Phoenix Suns – New Orleans Pelicans', market: 'Vainqueur Phoenix Suns' },
  ],
}

function comboOutcome(outcomes: Outcome[]): Outcome {
  if (outcomes.some((o) => o === 'unknown')) return 'unknown'
  if (outcomes.some((o) => o === 'lost' || o === 'halflost')) return 'lost'
  return outcomes.every((o) => o === 'won') ? 'won' : 'unknown'
}

async function main() {
  const results = await fetchEspn('basketball/nba', '20220426')
  console.log(`ESPN: ${results.length} NBA games fetched for 2022-04-26\n`)

  const legOutcomes: Outcome[] = []
  for (const leg of bet.legs) {
    const fixture = matchFixture(leg.event, results)
    if (!fixture) {
      console.log(`❓ ${leg.event} → fixture not found`)
      legOutcomes.push('unknown')
      continue
    }
    const outcome = settleMarket(leg.market, fixture)
    legOutcomes.push(outcome)
    console.log(
      `${outcome === 'won' ? '✅' : outcome === 'lost' ? '❌' : '❓'} ${fixture.away} @ ${fixture.home}  ` +
        `${fixture.awayScore}-${fixture.homeScore}  |  "${leg.market}" → ${outcome.toUpperCase()}`
    )
  }

  const combo = comboOutcome(legOutcomes)
  const payout = combo === 'won' ? (bet.stake * bet.odds).toFixed(2) : '0.00'
  console.log(`\n🎟️  Combiné (${bet.stake}€ @ ${bet.odds}) → ${combo.toUpperCase()}  |  gain: ${payout}€`)
  console.log(`Winamax avait affiché: GAGNÉ 28,56€`)
}

main().catch((e) => {
  console.error('error:', e.message)
  process.exit(1)
})
