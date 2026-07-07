import { useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../store'
import { useUI, useActiveBankroll } from '../hooks'
import { betProfit, isSettled, potentialReturn } from '../lib/stats'
import { fmtMoney, fmtOdds, fmtDate, todayISO } from '../lib/format'
import { Icon } from './Icon'
import { Modal, StatusBadge } from './ui'
import type { Bet, BetStatus } from '../types'

export function BetCard({ bet, currency }: { bet: Bet; currency: string }) {
  const { t, lang } = useI18n()
  const settings = useStore((s) => s.settings)
  const openDetail = useUI((s) => s.openDetail)
  const settled = isSettled(bet)
  const profit = betProfit(bet)

  return (
    <button className="bet-card" onClick={() => openDetail(bet.id)}>
      <div className="bet-main">
        <div className="bet-top">
          <span className="bet-sport">{t(`sport.${bet.sport}` as 'sport.other')}</span>
          {bet.isLive && <span className="live-tag">{t('bets.live')}</span>}
          {bet.type === 'combo' && <span className="combo-tag">{t('form.combo')}</span>}
          <span className="bet-date">{fmtDate(bet.date, lang)}</span>
        </div>
        <span className="bet-event">{bet.event}</span>
        <span className="bet-market">
          {bet.type === 'combo' ? t('bets.legsCount', { n: bet.legs.length }) : bet.market}
          {bet.bookmaker ? ` · ${bet.bookmaker}` : ''}
        </span>
      </div>
      <div className="bet-side">
        <span className="bet-odds">{fmtOdds(bet.odds, settings.oddsFormat, lang)}</span>
        <span className="bet-stake">{fmtMoney(bet.stake, currency, lang)}</span>
        {settled ? (
          <span className={`bet-profit ${profit >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(profit, currency, lang, { sign: true })}</span>
        ) : (
          <StatusBadge status="pending" />
        )}
      </div>
    </button>
  )
}

export function BetDetail() {
  const { t, lang } = useI18n()
  const detailId = useUI((s) => s.detailId)
  const closeDetail = useUI((s) => s.closeDetail)
  const openForm = useUI((s) => s.openForm)
  const settings = useStore((s) => s.settings)
  const settleBet = useStore((s) => s.settleBet)
  const deleteBet = useStore((s) => s.deleteBet)
  const bets = useStore((s) => s.bets)
  const { bankroll } = useActiveBankroll()
  const [cashout, setCashout] = useState('')

  const bet = bets.find((b) => b.id === detailId)
  if (!bet || !bankroll) return null

  const currency = bankroll.currency
  const settled = isSettled(bet)
  const profit = betProfit(bet)

  const settle = (status: BetStatus) => {
    if (status === 'cashout') {
      const amount = parseFloat(cashout.replace(',', '.'))
      if (!isFinite(amount) || amount < 0) return
      settleBet(bet.id, status, amount)
    } else {
      settleBet(bet.id, status)
    }
    closeDetail()
  }

  const duplicate = () => {
    closeDetail()
    openForm({
      prefill: {
        sport: bet.sport,
        event: bet.event,
        market: bet.market,
        type: bet.type,
        isLive: bet.isLive,
        legs: bet.legs,
        odds: bet.odds,
        stake: bet.stake,
        bookmaker: bet.bookmaker,
        tipster: bet.tipster,
        date: todayISO(),
      },
    })
  }

  return (
    <Modal open onClose={closeDetail} title={bet.event}>
      <div className="detail-head">
        <StatusBadge status={bet.status} />
        {bet.isLive && <span className="live-tag">{t('bets.live')}</span>}
        <span className="bet-date">{fmtDate(bet.date, lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <div className="detail-grid">
        <div>
          <span className="detail-label">{t('form.sport')}</span>
          <span>{t(`sport.${bet.sport}` as 'sport.other')}</span>
        </div>
        <div>
          <span className="detail-label">{t('form.odds')}</span>
          <span>{fmtOdds(bet.odds, settings.oddsFormat, lang)}</span>
        </div>
        <div>
          <span className="detail-label">{t('form.stake')}</span>
          <span>{fmtMoney(bet.stake, currency, lang)}</span>
        </div>
        <div>
          <span className="detail-label">{settled ? t('dash.profit') : t('bets.potential')}</span>
          <span className={settled ? (profit >= 0 ? 'pos' : 'neg') : ''}>
            {settled ? fmtMoney(profit, currency, lang, { sign: true }) : fmtMoney(potentialReturn(bet), currency, lang)}
          </span>
        </div>
        {bet.bookmaker && (
          <div>
            <span className="detail-label">{t('form.bookmaker')}</span>
            <span>{bet.bookmaker}</span>
          </div>
        )}
        {bet.tipster && (
          <div>
            <span className="detail-label">{t('form.tipster')}</span>
            <span>{bet.tipster}</span>
          </div>
        )}
      </div>

      {bet.type === 'combo' ? (
        <div className="detail-legs">
          <span className="detail-label">{t('form.legs')}</span>
          {bet.legs.map((l) => (
            <div key={l.id} className="detail-leg">
              <span>{l.selection}</span>
              <span className="leg-odds">{fmtOdds(l.odds, settings.oddsFormat, lang)}</span>
            </div>
          ))}
        </div>
      ) : (
        bet.market && (
          <div className="detail-legs">
            <span className="detail-label">{t('form.market')}</span>
            <div className="detail-leg">
              <span>{bet.market}</span>
            </div>
          </div>
        )
      )}

      {bet.notes && <p className="detail-notes">{bet.notes}</p>}

      {!settled && (
        <div className="settle-box">
          <span className="detail-label">{t('bets.settle')}</span>
          <div className="settle-row">
            <button className="btn settle-won" onClick={() => settle('won')}>
              <Icon name="check" size={16} /> {t('status.won')}
            </button>
            <button className="btn settle-lost" onClick={() => settle('lost')}>
              <Icon name="x" size={16} /> {t('status.lost')}
            </button>
            <button className="btn" onClick={() => settle('void')}>
              {t('status.void')}
            </button>
          </div>
          <div className="settle-row">
            <button className="btn btn-sm" onClick={() => settle('halfwon')}>
              {t('status.halfwon')}
            </button>
            <button className="btn btn-sm" onClick={() => settle('halflost')}>
              {t('status.halflost')}
            </button>
          </div>
          <div className="settle-row cashout-row">
            <input
              type="text"
              inputMode="decimal"
              placeholder={t('bets.cashoutAmount')}
              value={cashout}
              onChange={(e) => setCashout(e.target.value)}
            />
            <button className="btn" onClick={() => settle('cashout')} disabled={!cashout}>
              {t('status.cashout')}
            </button>
          </div>
        </div>
      )}

      <div className="detail-actions">
        {settled && (
          <button className="btn btn-sm" onClick={() => settle('pending')}>
            {t('bets.reopen')}
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={() => {
            closeDetail()
            openForm({ editingId: bet.id })
          }}
        >
          <Icon name="edit" size={15} /> {t('bets.edit')}
        </button>
        <button className="btn btn-sm" onClick={duplicate}>
          <Icon name="copy" size={15} /> {t('bets.duplicate')}
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm(t('bets.deleteConfirm'))) {
              deleteBet(bet.id)
              closeDetail()
            }
          }}
        >
          <Icon name="trash" size={15} /> {t('bets.delete')}
        </button>
      </div>
    </Modal>
  )
}
