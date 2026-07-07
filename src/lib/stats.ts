import type { Bet, Transaction } from '../types'

export function isSettled(b: Bet): boolean {
  return b.status !== 'pending'
}

export function betProfit(b: Bet): number {
  switch (b.status) {
    case 'won':
      return b.stake * (b.odds - 1)
    case 'lost':
      return -b.stake
    case 'void':
      return 0
    case 'halfwon':
      return (b.stake * (b.odds - 1)) / 2
    case 'halflost':
      return -b.stake / 2
    case 'cashout':
      return (b.cashoutAmount ?? 0) - b.stake
    default:
      return 0
  }
}

export function potentialReturn(b: Bet): number {
  return b.stake * b.odds
}

export interface Metrics {
  profit: number
  staked: number
  yield: number
  roi: number
  winRate: number
  avgOdds: number
  avgStake: number
  settledCount: number
  pendingCount: number
  pendingStake: number
  wonCount: number
  lostCount: number
  currentStreak: number
  bestWinStreak: number
  worstLoseStreak: number
  maxDrawdown: number
}

export function computeMetrics(bets: Bet[], startingCapital: number): Metrics {
  const settled = bets.filter(isSettled).sort((a, b) => (a.settledAt || a.date).localeCompare(b.settledAt || b.date))
  const pending = bets.filter((b) => !isSettled(b))
  const counted = settled.filter((b) => b.status !== 'void')
  const profit = settled.reduce((s, b) => s + betProfit(b), 0)
  const staked = counted.reduce((s, b) => s + b.stake, 0)
  const wonCount = settled.filter((b) => b.status === 'won' || b.status === 'halfwon').length
  const lostCount = settled.filter((b) => b.status === 'lost' || b.status === 'halflost').length

  let currentStreak = 0
  for (let i = settled.length - 1; i >= 0; i--) {
    const p = betProfit(settled[i])
    if (p === 0) continue
    if (currentStreak === 0) currentStreak = p > 0 ? 1 : -1
    else if (currentStreak > 0 && p > 0) currentStreak++
    else if (currentStreak < 0 && p < 0) currentStreak--
    else break
  }

  let bestWinStreak = 0
  let worstLoseStreak = 0
  let w = 0
  let l = 0
  let peak = startingCapital
  let cum = startingCapital
  let maxDrawdown = 0
  for (const b of settled) {
    const p = betProfit(b)
    cum += p
    if (cum > peak) peak = cum
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - cum) / peak)
    if (p > 0) {
      w++
      l = 0
    } else if (p < 0) {
      l++
      w = 0
    }
    bestWinStreak = Math.max(bestWinStreak, w)
    worstLoseStreak = Math.max(worstLoseStreak, l)
  }

  return {
    profit,
    staked,
    yield: staked > 0 ? (profit / staked) * 100 : 0,
    roi: startingCapital > 0 ? (profit / startingCapital) * 100 : 0,
    winRate: wonCount + lostCount > 0 ? (wonCount / (wonCount + lostCount)) * 100 : 0,
    avgOdds: counted.length > 0 ? counted.reduce((s, b) => s + b.odds, 0) / counted.length : 0,
    avgStake: counted.length > 0 ? staked / counted.length : 0,
    settledCount: settled.length,
    pendingCount: pending.length,
    pendingStake: pending.reduce((s, b) => s + b.stake, 0),
    wonCount,
    lostCount,
    currentStreak,
    bestWinStreak,
    worstLoseStreak,
    maxDrawdown: maxDrawdown * 100,
  }
}

export function currentBalance(bets: Bet[], txs: Transaction[], startingCapital: number): number {
  const txSum = txs.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0)
  const profit = bets.filter(isSettled).reduce((s, b) => s + betProfit(b), 0)
  return startingCapital + txSum + profit
}

export interface SeriesPoint {
  date: string
  value: number
}

export function balanceSeries(bets: Bet[], txs: Transaction[], startingCapital: number, createdAt: string): SeriesPoint[] {
  type Ev = { date: string; delta: number }
  const events: Ev[] = []
  for (const b of bets) {
    if (!isSettled(b)) continue
    events.push({ date: b.settledAt || b.date, delta: betProfit(b) })
  }
  for (const t of txs) {
    events.push({ date: t.date, delta: t.type === 'deposit' ? t.amount : -t.amount })
  }
  events.sort((a, b) => a.date.localeCompare(b.date))
  const points: SeriesPoint[] = [{ date: createdAt, value: startingCapital }]
  let cum = startingCapital
  for (const e of events) {
    cum += e.delta
    points.push({ date: e.date, value: cum })
  }
  return points
}

export interface GroupRow {
  key: string
  profit: number
  staked: number
  count: number
  yield: number
  winRate: number
}

export function groupMetrics(bets: Bet[], keyFn: (b: Bet) => string): GroupRow[] {
  const map = new Map<string, { profit: number; staked: number; count: number; won: number; lost: number }>()
  for (const b of bets) {
    if (!isSettled(b)) continue
    const key = keyFn(b)
    const row = map.get(key) || { profit: 0, staked: 0, count: 0, won: 0, lost: 0 }
    row.profit += betProfit(b)
    if (b.status !== 'void') row.staked += b.stake
    row.count++
    if (b.status === 'won' || b.status === 'halfwon') row.won++
    if (b.status === 'lost' || b.status === 'halflost') row.lost++
    map.set(key, row)
  }
  return [...map.entries()]
    .map(([key, r]) => ({
      key,
      profit: r.profit,
      staked: r.staked,
      count: r.count,
      yield: r.staked > 0 ? (r.profit / r.staked) * 100 : 0,
      winRate: r.won + r.lost > 0 ? (r.won / (r.won + r.lost)) * 100 : 0,
    }))
    .sort((a, b) => b.profit - a.profit)
}

export function oddsBucket(odds: number): string {
  if (odds < 1.5) return '1.01–1.49'
  if (odds < 2) return '1.50–1.99'
  if (odds < 3) return '2.00–2.99'
  if (odds < 5) return '3.00–4.99'
  return '5.00+'
}

export function consecutiveLosses(bets: Bet[]): { count: number; escalating: boolean } {
  const settled = bets.filter(isSettled).sort((a, b) => (b.settledAt || b.date).localeCompare(a.settledAt || a.date))
  let count = 0
  const stakes: number[] = []
  for (const b of settled) {
    const p = betProfit(b)
    if (p < 0) {
      count++
      stakes.push(b.stake)
    } else if (p > 0) break
  }
  let escalating = false
  for (let i = 0; i < stakes.length - 1; i++) {
    if (stakes[i] > stakes[i + 1]) escalating = true
  }
  return { count, escalating }
}

export function todayLoss(bets: Bet[]): number {
  const today = new Date().toISOString().slice(0, 10)
  return bets
    .filter(isSettled)
    .filter((b) => (b.settledAt || b.date).slice(0, 10) === today)
    .reduce((s, b) => s + betProfit(b), 0)
}
