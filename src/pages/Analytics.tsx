import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useActiveBankroll } from '../hooks'
import { groupMetrics, oddsBucket, isSettled, betProfit } from '../lib/stats'
import { fmtMoney, fmtPct, localeOf } from '../lib/format'
import { MonthlyBars, BarList } from '../components/charts'
import { EmptyState, Segmented } from '../components/ui'
import type { Bet } from '../types'

type Dim = 'sport' | 'bookmaker' | 'market' | 'odds' | 'weekday' | 'type' | 'tipster'
type Period = '30d' | '90d' | 'all'

export function Analytics() {
  const { t, lang } = useI18n()
  const { bankroll, bets } = useActiveBankroll()
  const [dim, setDim] = useState<Dim>('sport')
  const [period, setPeriod] = useState<Period>('all')

  if (!bankroll) return null
  const currency = bankroll.currency
  const locale = localeOf(lang)

  const periodBets = useMemo(() => {
    if (period === 'all') return bets
    const days = period === '30d' ? 30 : 90
    const d = new Date()
    d.setDate(d.getDate() - days)
    const cutoff = d.toISOString()
    return bets.filter((b) => b.date >= cutoff)
  }, [bets, period])

  const settled = useMemo(() => periodBets.filter(isSettled), [periodBets])

  const monthly = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of settled) {
      const key = (b.settledAt || b.date).slice(0, 7)
      map.set(key, (map.get(key) || 0) + betProfit(b))
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([key, value]) => {
        const [y, m] = key.split('-').map(Number)
        return { label: new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'short' }), value }
      })
  }, [settled, locale])

  const keyFns: Record<Dim, (b: Bet) => string> = {
    sport: (b) => t(`sport.${b.sport}` as 'sport.other'),
    bookmaker: (b) => b.bookmaker || '—',
    market: (b) => (b.type === 'combo' ? t('type.combo') : b.market || '—'),
    odds: (b) => oddsBucket(b.odds),
    weekday: (b) => String(new Date(b.date).getDay()),
    type: (b) => `${b.type === 'combo' ? t('type.combo') : t('type.single')}${b.isLive ? ` · ${t('type.live')}` : ''}`,
    tipster: (b) => b.tipster || '—',
  }

  const rows = useMemo(() => {
    let r = groupMetrics(periodBets, keyFns[dim])
    if (dim === 'weekday') {
      const order = ['1', '2', '3', '4', '5', '6', '0']
      r = [...r].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
      const ref = new Date(2024, 0, 1)
      r = r.map((row) => {
        const idx = Number(row.key)
        const d = new Date(ref)
        d.setDate(ref.getDate() + ((idx - ref.getDay() + 7) % 7))
        return { ...row, key: d.toLocaleDateString(locale, { weekday: 'long' }) }
      })
    }
    if (dim === 'odds') {
      r = [...r].sort((a, b) => a.key.localeCompare(b.key))
    }
    return r
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodBets, dim, lang])

  const dims: { value: Dim; label: string }[] = [
    { value: 'sport', label: t('dim.sport') },
    { value: 'bookmaker', label: t('dim.bookmaker') },
    { value: 'market', label: t('dim.market') },
    { value: 'odds', label: t('dim.odds') },
    { value: 'type', label: t('dim.type') },
    { value: 'weekday', label: t('dim.weekday') },
    { value: 'tipster', label: t('dim.tipster') },
  ]

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('stats.title')}</h1>
        <Segmented<Period>
          small
          options={[
            { value: '30d', label: t('period.30d') },
            { value: '90d', label: t('period.90d') },
            { value: 'all', label: t('period.all') },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </header>

      {settled.length === 0 ? (
        <EmptyState icon="chart" title={t('bets.empty.title')} subtitle={t('stats.noData')} />
      ) : (
        <>
          <section className="card">
            <h2 className="card-title">{t('stats.monthly')}</h2>
            <MonthlyBars data={monthly} formatValue={(v) => fmtMoney(v, currency, lang, { sign: true })} />
          </section>

          <div className="dim-chips">
            {dims.map((d) => (
              <button key={d.value} className={`chip-btn${dim === d.value ? ' active' : ''}`} onClick={() => setDim(d.value)}>
                {d.label}
              </button>
            ))}
          </div>

          <section className="card">
            <BarList
              rows={rows}
              formatMoney={(v) => fmtMoney(v, currency, lang, { sign: true })}
              formatPct={(v) => fmtPct(v, lang, { sign: true })}
              betsLabel={(n) => t('stats.nBets', { n })}
            />
          </section>
        </>
      )}
    </div>
  )
}
