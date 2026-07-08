export type BetStatus = 'pending' | 'won' | 'lost' | 'void' | 'halfwon' | 'halflost' | 'cashout'
export type BetType = 'single' | 'combo'
export type OddsFormat = 'decimal' | 'american' | 'fractional'
export type StakingMethod = 'fixed' | 'percent' | 'kelly'
export type Theme = 'dark' | 'light'

export interface BetLeg {
  id: string
  event?: string
  selection: string
  odds: number
}

export interface Bet {
  id: string
  bankrollId: string
  date: string
  sport: string
  event: string
  market: string
  type: BetType
  isLive: boolean
  legs: BetLeg[]
  odds: number
  stake: number
  status: BetStatus
  cashoutAmount?: number
  bookmaker: string
  tipster?: string
  notes?: string
  createdAt: string
  settledAt?: string
}

export interface Transaction {
  id: string
  bankrollId: string
  type: 'deposit' | 'withdrawal'
  amount: number
  date: string
  note?: string
}

export interface Bankroll {
  id: string
  name: string
  currency: string
  startingCapital: number
  createdAt: string
}

export interface Settings {
  language: string
  theme: Theme
  oddsFormat: OddsFormat
  stakingMethod: StakingMethod
  fixedStake: number
  percentStake: number
  kellyFraction: number
  stopLossDaily: number
  tiltAlert: boolean
}

export interface AppData {
  bankrolls: Bankroll[]
  bets: Bet[]
  transactions: Transaction[]
  settings: Settings
  activeBankrollId: string
}
