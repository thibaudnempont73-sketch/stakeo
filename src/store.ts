import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Bankroll, Bet, BetStatus, Settings, Transaction } from './types'
import { uid } from './lib/format'
import { detectLanguage } from './i18n'

const defaultSettings = (): Settings => ({
  language: detectLanguage(),
  theme: 'dark',
  oddsFormat: 'decimal',
  stakingMethod: 'percent',
  fixedStake: 10,
  percentStake: 2,
  kellyFraction: 0.25,
  stopLossDaily: 0,
  tiltAlert: true,
})

const STORAGE_KEY = 'stakeo-data'
try {
  const legacy = localStorage.getItem('stakely-data')
  if (legacy && !localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, legacy)
  }
} catch {
  /* storage unavailable */
}

interface AppState extends AppData {
  createBankroll: (name: string, currency: string, startingCapital: number) => void
  updateBankroll: (id: string, patch: Partial<Bankroll>) => void
  deleteBankroll: (id: string) => void
  setActiveBankroll: (id: string) => void
  addBet: (bet: Omit<Bet, 'id' | 'createdAt'>) => void
  updateBet: (id: string, patch: Partial<Bet>) => void
  deleteBet: (id: string) => void
  settleBet: (id: string, status: BetStatus, cashoutAmount?: number) => void
  addTransaction: (tx: Omit<Transaction, 'id'>) => void
  deleteTransaction: (id: string) => void
  updateSettings: (patch: Partial<Settings>) => void
  resetAll: () => void
  clearData: () => void
  importData: (data: Partial<AppData>) => boolean
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      bankrolls: [],
      bets: [],
      transactions: [],
      settings: defaultSettings(),
      activeBankrollId: '',

      createBankroll: (name, currency, startingCapital) => {
        const bk: Bankroll = { id: uid(), name, currency, startingCapital, createdAt: new Date().toISOString() }
        set((s) => ({ bankrolls: [...s.bankrolls, bk], activeBankrollId: bk.id }))
      },

      updateBankroll: (id, patch) =>
        set((s) => ({ bankrolls: s.bankrolls.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),

      deleteBankroll: (id) =>
        set((s) => {
          const bankrolls = s.bankrolls.filter((b) => b.id !== id)
          return {
            bankrolls,
            bets: s.bets.filter((b) => b.bankrollId !== id),
            transactions: s.transactions.filter((t) => t.bankrollId !== id),
            activeBankrollId: s.activeBankrollId === id ? (bankrolls[0]?.id ?? '') : s.activeBankrollId,
          }
        }),

      setActiveBankroll: (id) => set({ activeBankrollId: id }),

      addBet: (bet) =>
        set((s) => ({ bets: [...s.bets, { ...bet, id: uid(), createdAt: new Date().toISOString() }] })),

      updateBet: (id, patch) =>
        set((s) => ({ bets: s.bets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),

      deleteBet: (id) => set((s) => ({ bets: s.bets.filter((b) => b.id !== id) })),

      settleBet: (id, status, cashoutAmount) =>
        set((s) => ({
          bets: s.bets.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status,
                  cashoutAmount: status === 'cashout' ? cashoutAmount : undefined,
                  settledAt: status === 'pending' ? undefined : new Date().toISOString(),
                }
              : b
          ),
        })),

      addTransaction: (tx) => set((s) => ({ transactions: [...s.transactions, { ...tx, id: uid() }] })),

      deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetAll: () =>
        set({ bankrolls: [], bets: [], transactions: [], settings: defaultSettings(), activeBankrollId: '' }),

      // Clears user data but keeps device preferences (language/theme). Used on sign-out.
      clearData: () => set({ bankrolls: [], bets: [], transactions: [], activeBankrollId: '' }),

      importData: (data) => {
        if (!data || !Array.isArray(data.bankrolls) || !Array.isArray(data.bets)) return false
        set({
          bankrolls: data.bankrolls,
          bets: data.bets,
          transactions: Array.isArray(data.transactions) ? data.transactions : [],
          settings: { ...defaultSettings(), ...(data.settings || {}) },
          activeBankrollId:
            data.activeBankrollId && data.bankrolls.some((b) => b.id === data.activeBankrollId)
              ? data.activeBankrollId
              : (data.bankrolls[0]?.id ?? ''),
        })
        return true
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<AppData>
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings || {}) },
        }
      },
    }
  )
)

export function exportJSON(): string {
  const { bankrolls, bets, transactions, settings, activeBankrollId } = useStore.getState()
  return JSON.stringify({ app: 'stakeo', version: 1, bankrolls, bets, transactions, settings, activeBankrollId }, null, 2)
}

export function exportCSV(bankrollId: string): string {
  const { bets } = useStore.getState()
  const rows = bets.filter((b) => b.bankrollId === bankrollId)
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['date', 'sport', 'event', 'market', 'type', 'live', 'odds', 'stake', 'status', 'cashout', 'bookmaker', 'tipster', 'notes', 'legs']
  const lines = rows.map((b) =>
    [
      b.date,
      b.sport,
      b.event,
      b.market,
      b.type,
      b.isLive ? 'yes' : 'no',
      b.odds,
      b.stake,
      b.status,
      b.cashoutAmount ?? '',
      b.bookmaker,
      b.tipster ?? '',
      b.notes ?? '',
      b.legs.map((l) => `${l.selection} @${l.odds}`).join(' | '),
    ]
      .map(esc)
      .join(';')
  )
  return [header.join(';'), ...lines].join('\n')
}
