import { supabase } from './supabase'
import type { Bankroll, Bet, Transaction } from '../types'

interface Snapshot {
  bankrolls: Bankroll[]
  bets: Bet[]
  transactions: Transaction[]
}

function client() {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ── mappers: app camelCase ↔ db snake_case ──────────────────

function bankrollRow(b: Bankroll, userId: string) {
  return { id: b.id, user_id: userId, name: b.name, currency: b.currency, starting_capital: b.startingCapital, created_at: b.createdAt }
}
function toBankroll(r: any): Bankroll {
  return { id: r.id, name: r.name, currency: r.currency, startingCapital: Number(r.starting_capital), createdAt: r.created_at }
}

function betRow(b: Bet, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    bankroll_id: b.bankrollId,
    date: b.date,
    sport: b.sport,
    event: b.event,
    market: b.market,
    type: b.type,
    is_live: b.isLive,
    legs: b.legs,
    odds: b.odds,
    stake: b.stake,
    status: b.status,
    cashout_amount: b.cashoutAmount ?? null,
    bookmaker: b.bookmaker,
    tipster: b.tipster ?? null,
    notes: b.notes ?? null,
    created_at: b.createdAt,
    settled_at: b.settledAt ?? null,
  }
}
function toBet(r: any): Bet {
  return {
    id: r.id,
    bankrollId: r.bankroll_id,
    date: r.date,
    sport: r.sport,
    event: r.event,
    market: r.market ?? '',
    type: r.type,
    isLive: !!r.is_live,
    legs: Array.isArray(r.legs) ? r.legs : [],
    odds: Number(r.odds),
    stake: Number(r.stake),
    status: r.status,
    cashoutAmount: r.cashout_amount == null ? undefined : Number(r.cashout_amount),
    bookmaker: r.bookmaker ?? '',
    tipster: r.tipster ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    settledAt: r.settled_at ?? undefined,
  }
}

function txRow(t: Transaction, userId: string) {
  return { id: t.id, user_id: userId, bankroll_id: t.bankrollId, type: t.type, amount: t.amount, date: t.date, note: t.note ?? null }
}
function toTx(r: any): Transaction {
  return { id: r.id, bankrollId: r.bankroll_id, type: r.type, amount: Number(r.amount), date: r.date, note: r.note ?? undefined }
}

// ── read ─────────────────────────────────────────────────────

export async function fetchAll(userId: string): Promise<Snapshot> {
  const sb = client()
  const [bk, bt, tx] = await Promise.all([
    sb.from('bankrolls').select('*').eq('user_id', userId),
    sb.from('bets').select('*').eq('user_id', userId),
    sb.from('transactions').select('*').eq('user_id', userId),
  ])
  if (bk.error) throw bk.error
  if (bt.error) throw bt.error
  if (tx.error) throw tx.error
  return {
    bankrolls: (bk.data ?? []).map(toBankroll),
    bets: (bt.data ?? []).map(toBet),
    transactions: (tx.data ?? []).map(toTx),
  }
}

// ── write: mirror the local snapshot to the cloud ───────────

async function mirror(table: string, userId: string, rows: { id: string }[]): Promise<void> {
  const sb = client()
  const { data: existing, error } = await sb.from(table).select('id').eq('user_id', userId)
  if (error) throw error
  const currentIds = new Set(rows.map((r) => r.id))
  const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !currentIds.has(id))
  if (toDelete.length) {
    const { error: delErr } = await sb.from(table).delete().in('id', toDelete)
    if (delErr) throw delErr
  }
  if (rows.length) {
    const { error: upErr } = await sb.from(table).upsert(rows)
    if (upErr) throw upErr
  }
}

export async function pushAll(userId: string, snap: Snapshot): Promise<void> {
  await mirror('bankrolls', userId, snap.bankrolls.map((b) => bankrollRow(b, userId)))
  await mirror('bets', userId, snap.bets.map((b) => betRow(b, userId)))
  await mirror('transactions', userId, snap.transactions.map((t) => txRow(t, userId)))
}
