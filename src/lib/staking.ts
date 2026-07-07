import type { Settings } from '../types'

export function kellyFraction(odds: number, prob: number): number {
  const b = odds - 1
  if (b <= 0 || prob <= 0) return 0
  const f = (odds * prob - 1) / b
  return Math.max(0, f)
}

export function suggestedStake(settings: Settings, balance: number, odds?: number, prob?: number): number {
  if (balance <= 0) return 0
  switch (settings.stakingMethod) {
    case 'fixed':
      return settings.fixedStake
    case 'percent':
      return round2((settings.percentStake / 100) * balance)
    case 'kelly': {
      if (!odds || !prob) return round2((settings.percentStake / 100) * balance)
      const f = kellyFraction(odds, prob) * settings.kellyFraction
      return round2(Math.min(f, 0.25) * balance)
    }
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
