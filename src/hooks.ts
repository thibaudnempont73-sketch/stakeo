import { useMemo } from 'react'
import { create } from 'zustand'
import { useStore } from './store'
import { currentBalance } from './lib/stats'
import type { Bet } from './types'

export type Tab = 'dashboard' | 'bets' | 'stats' | 'settings'

interface UIState {
  tab: Tab
  setTab: (t: Tab) => void
  formOpen: boolean
  editingId: string | null
  prefill: Partial<Bet> | null
  openForm: (opts?: { editingId?: string; prefill?: Partial<Bet> }) => void
  closeForm: () => void
  detailId: string | null
  openDetail: (id: string) => void
  closeDetail: () => void
  scanBlob: Blob | null
  setScanBlob: (b: Blob | null) => void
  breakNoticeOpen: boolean
  setBreakNotice: (open: boolean) => void
}

/** Responsible-gambling break: true while a "take a break" period is active. */
export function isOnBreak(): boolean {
  const until = useStore.getState().settings.breakUntil
  return !!until && Date.parse(until) > Date.now()
}

export const useUI = create<UIState>((set) => ({
  tab: 'dashboard',
  setTab: (tab) => set({ tab }),
  formOpen: false,
  editingId: null,
  prefill: null,
  openForm: (opts) => {
    // Block logging NEW bets during a self-imposed break (editing stays allowed).
    if (!opts?.editingId && isOnBreak()) {
      set({ breakNoticeOpen: true })
      return
    }
    set({ formOpen: true, editingId: opts?.editingId ?? null, prefill: opts?.prefill ?? null })
  },
  closeForm: () => set({ formOpen: false, editingId: null, prefill: null }),
  detailId: null,
  openDetail: (id) => set({ detailId: id }),
  closeDetail: () => set({ detailId: null }),
  scanBlob: null,
  setScanBlob: (scanBlob) => set({ scanBlob }),
  breakNoticeOpen: false,
  setBreakNotice: (breakNoticeOpen) => set({ breakNoticeOpen }),
}))

export function useActiveBankroll() {
  const bankrolls = useStore((s) => s.bankrolls)
  const activeId = useStore((s) => s.activeBankrollId)
  const allBets = useStore((s) => s.bets)
  const allTxs = useStore((s) => s.transactions)

  const bankroll = bankrolls.find((b) => b.id === activeId) || bankrolls[0]

  const bets = useMemo(
    () =>
      allBets
        .filter((b) => b.bankrollId === bankroll?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allBets, bankroll?.id]
  )
  const txs = useMemo(() => allTxs.filter((t) => t.bankrollId === bankroll?.id), [allTxs, bankroll?.id])

  const balance = useMemo(
    () => (bankroll ? currentBalance(bets, txs, bankroll.startingCapital) : 0),
    [bets, txs, bankroll]
  )

  return { bankroll, bankrolls, bets, txs, balance }
}

export const SPORTS = [
  'football',
  'tennis',
  'basketball',
  'esports',
  'rugby',
  'handball',
  'volleyball',
  'hockey',
  'baseball',
  'amfootball',
  'mma',
  'boxing',
  'golf',
  'horse',
  'motorsport',
  'darts',
  'other',
] as const

export const BOOKMAKERS = [
  'Bet365',
  'Winamax',
  'Betclic',
  'Unibet',
  'Bwin',
  'Stake',
  'Pinnacle',
  'Betfair',
  'PMU',
  'ZEbet',
  'Parions Sport',
  'PokerStars Sports',
  'Betsson',
  'LeoVegas',
  'William Hill',
  'Ladbrokes',
  'Betway',
  'Tipico',
  '888sport',
]

export const CURRENCIES = ['EUR', 'GBP', 'USD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'CAD', 'AUD', 'BRL']
