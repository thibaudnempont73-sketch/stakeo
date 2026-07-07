import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useActiveBankroll } from '../hooks'
import { fmtDateLong, dayKey } from '../lib/format'
import { BetCard } from '../components/bets'
import { EmptyState, Segmented } from '../components/ui'
import { Icon } from '../components/Icon'

type Filter = 'all' | 'pending' | 'won' | 'lost' | 'other'

export function Bets() {
  const { t, lang } = useI18n()
  const { bankroll, bets } = useActiveBankroll()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  if (!bankroll) return null

  const filtered = useMemo(() => {
    let list = bets
    if (filter === 'pending') list = list.filter((b) => b.status === 'pending')
    else if (filter === 'won') list = list.filter((b) => b.status === 'won' || b.status === 'halfwon')
    else if (filter === 'lost') list = list.filter((b) => b.status === 'lost' || b.status === 'halflost')
    else if (filter === 'other') list = list.filter((b) => ['void', 'cashout'].includes(b.status))
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (b) =>
          b.event.toLowerCase().includes(q) ||
          b.market.toLowerCase().includes(q) ||
          b.bookmaker.toLowerCase().includes(q) ||
          (b.tipster || '').toLowerCase().includes(q) ||
          b.legs.some((l) => l.selection.toLowerCase().includes(q))
      )
    }
    return list
  }, [bets, filter, query])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const b of filtered) {
      const key = dayKey(b.date)
      const arr = map.get(key) || []
      arr.push(b)
      map.set(key, arr)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString())
  const dayLabel = (key: string) =>
    key === today ? t('common.today') : key === yesterday ? t('common.yesterday') : fmtDateLong(key, lang)

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('bets.title')}</h1>
      </header>

      <div className="search-box">
        <Icon name="search" size={17} />
        <input type="text" placeholder={t('bets.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button className="icon-btn" onClick={() => setQuery('')} aria-label={t('common.close')}>
            <Icon name="x" size={15} />
          </button>
        )}
      </div>

      <Segmented<Filter>
        options={[
          { value: 'all', label: t('filter.all') },
          { value: 'pending', label: t('filter.pending') },
          { value: 'won', label: t('filter.won') },
          { value: 'lost', label: t('filter.lost') },
          { value: 'other', label: t('filter.other') },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {groups.length === 0 ? (
        <EmptyState icon="search" title={t('bets.empty.title')} subtitle={t('bets.empty.subtitle')} />
      ) : (
        groups.map(([key, list]) => (
          <section key={key}>
            <h3 className="day-head">{dayLabel(key)}</h3>
            <div className="bet-list">
              {list.map((b) => (
                <BetCard key={b.id} bet={b} currency={bankroll.currency} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
