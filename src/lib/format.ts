import type { OddsFormat } from '../types'

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const LOCALES: Record<string, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
}

export function localeOf(lang: string): string {
  return LOCALES[lang] || 'en-GB'
}

export function fmtMoney(n: number, currency: string, lang: string, opts?: { sign?: boolean; compact?: boolean }): string {
  const locale = localeOf(lang)
  const abs = Math.abs(n)
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: abs >= 10000 ? 0 : 2,
    maximumFractionDigits: abs >= 10000 ? 0 : 2,
  }).format(opts?.sign ? abs : n)
  if (opts?.sign) return (n >= 0 ? '+' : '−') + formatted
  return formatted
}

export function fmtNumber(n: number, lang: string, digits = 2): string {
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: digits }).format(n)
}

export function fmtPct(n: number, lang: string, opts?: { sign?: boolean }): string {
  const v = new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 1 }).format(Math.abs(n))
  const sign = opts?.sign ? (n >= 0 ? '+' : '−') : n < 0 ? '−' : ''
  return `${sign}${v} %`
}

function toFractional(decimal: number): string {
  const target = decimal - 1
  if (target <= 0) return '0/1'
  let best = { num: 1, den: 1, err: Infinity }
  for (let den = 1; den <= 25; den++) {
    const num = Math.round(target * den)
    if (num === 0) continue
    const err = Math.abs(num / den - target)
    if (err < best.err - 1e-9) best = { num, den, err }
  }
  return `${best.num}/${best.den}`
}

function toAmerican(decimal: number): string {
  if (decimal >= 2) return `+${Math.round((decimal - 1) * 100)}`
  if (decimal <= 1) return '+0'
  return `${Math.round(-100 / (decimal - 1))}`
}

export function fmtOdds(decimal: number, format: OddsFormat, lang: string): string {
  if (!isFinite(decimal) || decimal <= 1) format = 'decimal'
  switch (format) {
    case 'american':
      return toAmerican(decimal)
    case 'fractional':
      return toFractional(decimal)
    default:
      return fmtNumber(decimal, lang, 2)
  }
}

export function fmtDate(iso: string, lang: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat(localeOf(lang), opts || { day: 'numeric', month: 'short' }).format(d)
}

export function fmtDateLong(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
