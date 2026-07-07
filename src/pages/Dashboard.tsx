import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../store'
import { useUI, useActiveBankroll } from '../hooks'
import { computeMetrics, balanceSeries, consecutiveLosses, todayLoss } from '../lib/stats'
import { suggestedStake } from '../lib/staking'
import { fmtMoney, fmtNumber, fmtPct, fmtDate } from '../lib/format'
import { checkResults, AIError, GEMINI_KEY, hasAI, type SettleVerdict } from '../lib/ai'
import { AreaChart } from '../components/charts'
import { BetCard } from '../components/bets'
import { StatCard, Segmented, EmptyState, Modal, StatusBadge } from '../components/ui'
import { Icon } from '../components/Icon'

type Period = '7d' | '30d' | '90d' | 'all'
const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, all: 0 }

export function Dashboard() {
  const { t, lang } = useI18n()
  const { bankroll, bankrolls, bets, txs, balance } = useActiveBankroll()
  const settings = useStore((s) => s.settings)
  const setActiveBankroll = useStore((s) => s.setActiveBankroll)
  const settleBet = useStore((s) => s.settleBet)
  const openForm = useUI((s) => s.openForm)
  const setTab = useUI((s) => s.setTab)
  const [period, setPeriod] = useState<Period>('30d')
  const [checking, setChecking] = useState(false)
  const [verdicts, setVerdicts] = useState<SettleVerdict[] | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  if (!bankroll) return null
  const currency = bankroll.currency

  const cutoff = useMemo(() => {
    const days = PERIOD_DAYS[period]
    if (!days) return null
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString()
  }, [period])

  const periodBets = useMemo(() => (cutoff ? bets.filter((b) => b.date >= cutoff) : bets), [bets, cutoff])
  const metrics = useMemo(() => computeMetrics(periodBets, bankroll.startingCapital), [periodBets, bankroll.startingCapital])

  const series = useMemo(() => {
    const full = balanceSeries(bets, txs, bankroll.startingCapital, bankroll.createdAt)
    if (!cutoff) return full
    const before = full.filter((p) => p.date < cutoff)
    const after = full.filter((p) => p.date >= cutoff)
    const startValue = before.length > 0 ? before[before.length - 1].value : bankroll.startingCapital
    return [{ date: cutoff, value: startValue }, ...after]
  }, [bets, txs, bankroll, cutoff])

  const tilt = useMemo(() => consecutiveLosses(bets), [bets])
  const dayLoss = useMemo(() => todayLoss(bets), [bets])
  const stopLossHit = settings.stopLossDaily > 0 && dayLoss <= -settings.stopLossDaily
  const showTilt = settings.tiltAlert && tilt.count >= 3 && tilt.escalating && !stopLossHit
  const suggestion = suggestedStake(settings, balance)
  const recent = bets.slice(0, 5)
  const money = (v: number) => fmtMoney(v, currency, lang)

  const checkable = useMemo(
    () => bets.filter((b) => b.status === 'pending' && new Date(b.date).getTime() < Date.now() - 2 * 3600e3),
    [bets]
  )

  const runCheck = async () => {
    if (!hasAI || checking || checkable.length === 0) return
    setChecking(true)
    setCheckError(null)
    try {
      const results = await checkResults(GEMINI_KEY, checkable.slice(0, 10), lang)
      for (const v of results) {
        if (v.status !== 'unknown' && v.confidence !== 'low') settleBet(v.id, v.status)
      }
      setVerdicts(results)
    } catch (err) {
      const kind = err instanceof AIError ? err.kind : 'parse'
      setCheckError(t(kind === 'badKey' ? 'ai.badKey' : kind === 'network' ? 'ai.netError' : 'ai.noneApplied'))
    } finally {
      setChecking(false)
    }
  }

  const appliedCount = verdicts ? verdicts.filter((v) => v.status !== 'unknown' && v.confidence !== 'low').length : 0

  return (
    <div className="page">
      <header className="dash-header">
        <div className="dash-title">
          {bankrolls.length > 1 ? (
            <select className="bankroll-select" value={bankroll.id} onChange={(e) => setActiveBankroll(e.target.value)}>
              {bankrolls.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="bankroll-name">{bankroll.name}</span>
          )}
          <span className="balance">{money(balance)}</span>
          <div className="balance-tags">
            {metrics.pendingStake > 0 && (
              <span className="chip">
                <Icon name="bolt" size={13} /> {money(metrics.pendingStake)} {t('dash.inPlay')}
              </span>
            )}
            {metrics.pendingCount > 0 && <span className="chip chip-muted">{t('dash.pending', { n: metrics.pendingCount })}</span>}
            {hasAI && checkable.length > 0 && (
              <button className="chip chip-action" onClick={runCheck} disabled={checking}>
                {checking ? <span className="spinner spinner-sm" /> : <Icon name="sparkles" size={13} />}
                {checking ? t('ai.checking') : t('ai.check')}
              </button>
            )}
            {checkError && <span className="chip chip-muted">{checkError}</span>}
          </div>
        </div>
        <Segmented<Period>
          small
          options={[
            { value: '7d', label: t('period.7d') },
            { value: '30d', label: t('period.30d') },
            { value: '90d', label: t('period.90d') },
            { value: 'all', label: t('period.all') },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </header>

      {stopLossHit && (
        <div className="alert alert-danger">
          <Icon name="alert" size={20} />
          <div>
            <strong>{t('dash.stopLoss.title')}</strong>
            <p>{t('dash.stopLoss.body', { loss: fmtMoney(dayLoss, currency, lang, { sign: true }), limit: money(settings.stopLossDaily) })}</p>
          </div>
        </div>
      )}
      {showTilt && (
        <div className="alert alert-warning">
          <Icon name="shield" size={20} />
          <div>
            <strong>{t('dash.tilt.title')}</strong>
            <p>{t('dash.tilt.body', { n: tilt.count, stake: money(suggestion) })}</p>
          </div>
        </div>
      )}

      {bets.length === 0 ? (
        <EmptyState
          icon="coins"
          title={t('dash.empty.title')}
          subtitle={t('dash.empty.subtitle')}
          action={
            <button className="btn btn-primary" onClick={() => openForm()}>
              <Icon name="plus" size={16} /> {t('dash.addBet')}
            </button>
          }
        />
      ) : (
        <>
          <section className="card chart-card">
            <AreaChart points={series} formatValue={money} formatDate={(d) => fmtDate(d, lang, { day: 'numeric', month: 'short', year: 'numeric' })} />
          </section>

          <section className="stat-grid">
            <StatCard
              label={t('dash.profit')}
              value={fmtMoney(metrics.profit, currency, lang, { sign: true })}
              tone={metrics.profit >= 0 ? 'up' : 'down'}
              sub={`${metrics.settledCount + metrics.pendingCount} ${t('dash.betCount').toLowerCase()}`}
            />
            <StatCard label={t('dash.yield')} value={fmtPct(metrics.yield, lang, { sign: true })} tone={metrics.yield >= 0 ? 'up' : 'down'} sub={`${t('dash.roi')} ${fmtPct(metrics.roi, lang, { sign: true })}`} />
            <StatCard label={t('dash.winRate')} value={fmtPct(metrics.winRate, lang)} sub={`${metrics.wonCount}W · ${metrics.lostCount}L`} />
            <StatCard label={t('dash.avgOdds')} value={fmtNumber(metrics.avgOdds, lang)} sub={`${t('dash.avgStake')} ${money(metrics.avgStake)}`} />
            <StatCard
              label={t('dash.streak')}
              value={metrics.currentStreak > 0 ? `+${metrics.currentStreak}` : String(metrics.currentStreak)}
              tone={metrics.currentStreak > 0 ? 'up' : metrics.currentStreak < 0 ? 'down' : undefined}
              sub={`${t('status.won')} ${metrics.bestWinStreak} · ${t('status.lost')} ${metrics.worstLoseStreak}`}
            />
            <StatCard label={t('dash.maxDrawdown')} value={fmtPct(-metrics.maxDrawdown, lang)} tone={metrics.maxDrawdown > 15 ? 'down' : undefined} />
          </section>

          <section className="suggest-card card">
            <div className="suggest-icon">
              <Icon name="target" size={22} />
            </div>
            <div className="suggest-text">
              <span className="stat-label">{t('dash.suggested')}</span>
              <span className="suggest-value">
                {money(suggestion)}
                <em> · {t(`staking.${settings.stakingMethod}`)}</em>
              </span>
            </div>
            <button className="btn btn-primary" onClick={() => openForm()}>
              <Icon name="plus" size={16} />
              <span className="hide-sm">{t('dash.addBet')}</span>
            </button>
          </section>

          <section>
            <div className="section-head">
              <h2>{t('dash.recentBets')}</h2>
              <button className="link-btn" onClick={() => setTab('bets')}>
                {t('dash.viewAll')} <Icon name="chevronRight" size={14} />
              </button>
            </div>
            <div className="bet-list">
              {recent.map((b) => (
                <BetCard key={b.id} bet={b} currency={currency} />
              ))}
            </div>
          </section>
        </>
      )}

      {verdicts && (
        <Modal open onClose={() => setVerdicts(null)} title={t('ai.resultsTitle')}>
          <p className="verdict-summary">{appliedCount > 0 ? t('ai.applied', { n: appliedCount }) : t('ai.noneApplied')}</p>
          <div className="verdict-list">
            {verdicts.map((v) => {
              const bet = bets.find((b) => b.id === v.id)
              return (
                <div key={v.id} className="verdict-row">
                  <div className="verdict-head">
                    <span className="verdict-event">{bet?.event || '—'}</span>
                    {v.status === 'unknown' ? (
                      <span className="badge badge-void">{t('ai.unknownResult')}</span>
                    ) : (
                      <StatusBadge status={v.status} />
                    )}
                  </div>
                  {v.explanation && <p className="verdict-expl">{v.explanation}</p>}
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}
