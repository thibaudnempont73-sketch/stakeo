import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { useStore } from '../store'
import { useUI, useActiveBankroll, SPORTS, BOOKMAKERS } from '../hooks'
import { suggestedStake, round2 } from '../lib/staking'
import { fmtMoney, fmtNumber, todayISO, uid } from '../lib/format'
import { compressImage, extractBetFromImage, AIError, hasAI, type ExtractedBet } from '../lib/ai'
import { Modal, Segmented, Field } from './ui'
import { Icon } from './Icon'
import type { Bet, BetType } from '../types'

const parseNum = (s: string) => parseFloat(s.replace(',', '.'))

interface LegDraft {
  id: string
  event: string
  selection: string
  odds: string
}

export function BetForm() {
  const { t, lang } = useI18n()
  const { editingId, prefill, closeForm } = useUI()
  const scanBlob = useUI((s) => s.scanBlob)
  const setScanBlob = useUI((s) => s.setScanBlob)
  const { bankroll, balance } = useActiveBankroll()
  const settings = useStore((s) => s.settings)
  const bets = useStore((s) => s.bets)
  const addBet = useStore((s) => s.addBet)
  const updateBet = useStore((s) => s.updateBet)

  const editing = editingId ? bets.find((b) => b.id === editingId) : undefined
  const base: Partial<Bet> = editing || prefill || {}

  const [type, setType] = useState<BetType>(base.type || 'single')
  const [sport, setSport] = useState(base.sport || 'football')
  const [event, setEvent] = useState(base.event || '')
  const [market, setMarket] = useState(base.market || '')
  const [odds, setOdds] = useState(base.odds ? String(base.odds) : '')
  const [stake, setStake] = useState(base.stake ? String(base.stake) : '')
  const [bookmaker, setBookmaker] = useState(base.bookmaker || '')
  const [date, setDate] = useState((base.date || todayISO()).slice(0, 16))
  const [isLive, setIsLive] = useState(base.isLive || false)
  const [legs, setLegs] = useState<LegDraft[]>(
    base.legs && base.legs.length > 0
      ? base.legs.map((l) => ({ id: l.id, event: l.event || '', selection: l.selection, odds: String(l.odds) }))
      : [
          { id: uid(), event: '', selection: '', odds: '' },
          { id: uid(), event: '', selection: '', odds: '' },
        ]
  )
  const [tipster, setTipster] = useState(base.tipster || '')
  const [notes, setNotes] = useState(base.notes || '')
  const [prob, setProb] = useState(55)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyExtracted = (ex: ExtractedBet) => {
    if (!ex.found) {
      setScanError(t('ai.scanError'))
      return
    }
    if ((SPORTS as readonly string[]).includes(ex.sport)) setSport(ex.sport)
    if (ex.event) setEvent(ex.event)
    if (ex.type === 'combo' && ex.legs && ex.legs.length >= 2) {
      setType('combo')
      setLegs(ex.legs.map((l) => ({ id: uid(), event: l.event || '', selection: l.selection, odds: String(l.odds) })))
    } else {
      setType('single')
      if (ex.market) setMarket(ex.market)
    }
    if (ex.odds > 1) setOdds(String(ex.odds))
    if (ex.stake > 0) setStake(String(ex.stake))
    if (ex.bookmaker) setBookmaker(ex.bookmaker)
    setIsLive(!!ex.isLive)
    if (ex.date && ex.date.length >= 16) setDate(ex.date.slice(0, 16))
  }

  const scan = async (blob: Blob) => {
    if (!hasAI || scanning) return
    setScanning(true)
    setScanError(null)
    try {
      const { data, mediaType } = await compressImage(blob)
      applyExtracted(await extractBetFromImage(data, mediaType, type))
    } catch (err) {
      const kind = err instanceof AIError ? err.kind : 'parse'
      setScanError(t(kind === 'badKey' ? 'ai.badKey' : kind === 'network' ? 'ai.netError' : kind === 'rate' ? 'ai.rateLimit' : 'ai.scanError'))
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    if (editing) return
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) {
        e.preventDefault()
        scan(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  useEffect(() => {
    if (scanBlob && !editing) {
      const blob = scanBlob
      setScanBlob(null)
      scan(blob)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanBlob])

  const comboOdds = useMemo(() => {
    const vals = legs.map((l) => parseNum(l.odds)).filter((v) => isFinite(v) && v > 1)
    if (vals.length === 0) return 0
    return round2(vals.reduce((a, b) => a * b, 1))
  }, [legs])

  const effOdds = type === 'combo' ? comboOdds : parseNum(odds)
  const suggestion = bankroll
    ? suggestedStake(settings, balance, isFinite(effOdds) ? effOdds : undefined, prob / 100)
    : 0

  if (!bankroll) return null

  const save = () => {
    const errs: Record<string, string> = {}
    if (type === 'single' && !event.trim()) errs.event = t('form.err.event')
    const stakeNum = parseNum(stake)
    if (!isFinite(stakeNum) || stakeNum <= 0) errs.stake = t('form.err.stake')
    let finalOdds: number
    let finalLegs = editing?.legs || []
    if (type === 'combo') {
      const parsed = legs
        .filter((l) => l.event.trim() || l.selection.trim() || l.odds.trim())
        .map((l) => ({ id: l.id, event: l.event.trim() || undefined, selection: l.selection.trim(), odds: parseNum(l.odds) }))
      if (parsed.length < 2 || parsed.some((l) => !l.selection || !isFinite(l.odds) || l.odds <= 1)) {
        errs.legs = t('form.err.legs')
      }
      finalLegs = parsed
      finalOdds = comboOdds
      if (finalOdds <= 1) errs.legs = errs.legs || t('form.err.legs')
    } else {
      finalOdds = parseNum(odds)
      if (!isFinite(finalOdds) || finalOdds <= 1) errs.odds = t('form.err.odds')
      finalLegs = []
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const data = {
      bankrollId: bankroll.id,
      date: date.length === 16 ? date : todayISO(),
      sport,
      event: event.trim(),
      market: market.trim(),
      type,
      isLive,
      legs: finalLegs,
      odds: finalOdds,
      stake: stakeNum,
      bookmaker: bookmaker.trim(),
      tipster: tipster.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    if (editing) {
      updateBet(editing.id, data)
    } else {
      addBet({ ...data, status: 'pending' })
    }
    closeForm()
  }

  return (
    <Modal open onClose={closeForm} title={editing ? t('form.editBet') : t('form.addBet')}>
      <div className="form-grid">
        {!editing && hasAI && (
          <div className="scan-zone">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) scan(f)
                e.target.value = ''
              }}
            />
            <button type="button" className="scan-btn" onClick={() => fileRef.current?.click()} disabled={scanning}>
              {scanning ? <span className="spinner" /> : <Icon name="camera" size={22} />}
              <span className="scan-text">
                <strong>{scanning ? t('ai.scanning') : t('ai.scan')}</strong>
                <em>{t('ai.scanHint')}</em>
              </span>
              {!scanning && <Icon name="sparkles" size={17} className="scan-spark" />}
            </button>
            {scanError && <span className="field-error">{scanError}</span>}
          </div>
        )}

        <Segmented<BetType>
          options={[
            { value: 'single', label: t('form.single') },
            { value: 'combo', label: t('form.combo') },
          ]}
          value={type}
          onChange={setType}
        />

        <div className="form-row">
          <Field label={t('form.sport')}>
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`sport.${s}` as 'sport.other')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.date')}>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {type === 'single' && (
          <Field label={t('form.event')} error={errors.event}>
            <input type="text" placeholder={t('form.eventPh')} value={event} onChange={(e) => setEvent(e.target.value)} autoFocus />
          </Field>
        )}

        {type === 'single' ? (
          <>
            <Field label={t('form.market')}>
              <input type="text" placeholder={t('form.marketPh')} value={market} onChange={(e) => setMarket(e.target.value)} />
            </Field>
            <div className="form-row">
              <Field label={t('form.odds')} error={errors.odds}>
                <input type="text" inputMode="decimal" placeholder="1.85" value={odds} onChange={(e) => setOdds(e.target.value)} />
              </Field>
              <Field label={`${t('form.stake')} (${bankroll.currency})`} error={errors.stake}>
                <input type="text" inputMode="decimal" placeholder="10" value={stake} onChange={(e) => setStake(e.target.value)} />
              </Field>
            </div>
          </>
        ) : (
          <>
            <div className="legs-box">
              <span className="field-label">{t('form.legs')}</span>
              {legs.map((leg, i) => (
                <div key={leg.id} className="leg-row">
                  <span className="leg-num">{i + 1}</span>
                  <div className="leg-fields">
                    <input
                      type="text"
                      className="leg-event-input"
                      placeholder={t('form.legEventPh')}
                      value={leg.event}
                      onChange={(e) => setLegs(legs.map((l) => (l.id === leg.id ? { ...l, event: e.target.value } : l)))}
                    />
                    <div className="leg-fields-row">
                      <input
                        type="text"
                        placeholder={t('form.legPh')}
                        value={leg.selection}
                        onChange={(e) => setLegs(legs.map((l) => (l.id === leg.id ? { ...l, selection: e.target.value } : l)))}
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="1.50"
                        className="leg-odds-input"
                        value={leg.odds}
                        onChange={(e) => setLegs(legs.map((l) => (l.id === leg.id ? { ...l, odds: e.target.value } : l)))}
                      />
                    </div>
                  </div>
                  {legs.length > 2 && (
                    <button className="icon-btn" onClick={() => setLegs(legs.filter((l) => l.id !== leg.id))} aria-label={t('common.delete')}>
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              ))}
              {errors.legs && <span className="field-error">{errors.legs}</span>}
              <div className="leg-footer">
                <button className="btn btn-sm" onClick={() => setLegs([...legs, { id: uid(), event: '', selection: '', odds: '' }])}>
                  <Icon name="plus" size={15} /> {t('form.addLeg')}
                </button>
                <span className="total-odds">
                  {t('form.totalOdds')}: <strong>{comboOdds > 1 ? fmtNumber(comboOdds, lang) : '—'}</strong>
                </span>
              </div>
            </div>
            <Field label={`${t('form.stake')} (${bankroll.currency})`} error={errors.stake}>
              <input type="text" inputMode="decimal" placeholder="10" value={stake} onChange={(e) => setStake(e.target.value)} />
            </Field>
          </>
        )}

        {settings.stakingMethod === 'kelly' && (
          <div className="kelly-box">
            <span className="field-label">
              {t('form.estProb')}: <strong>{prob} %</strong>
            </span>
            <input type="range" min="5" max="95" step="1" value={prob} onChange={(e) => setProb(Number(e.target.value))} />
          </div>
        )}

        {suggestion > 0 && (
          <div className="suggest-chip">
            <Icon name="target" size={16} />
            <span>
              {t('form.suggested')}: <strong>{fmtMoney(suggestion, bankroll.currency, lang)}</strong>
            </span>
            <button className="btn btn-sm" onClick={() => setStake(String(suggestion))}>
              {t('form.apply')}
            </button>
          </div>
        )}

        <div className="form-row">
          <Field label={t('form.bookmaker')}>
            <input type="text" list="bookmakers" value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} />
            <datalist id="bookmakers">
              {BOOKMAKERS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
          <Field label={t('form.tipster')} optional>
            <input type="text" value={tipster} onChange={(e) => setTipster(e.target.value)} />
          </Field>
        </div>

        <label className="check-row">
          <input type="checkbox" checked={isLive} onChange={(e) => setIsLive(e.target.checked)} />
          <span>{t('form.live')}</span>
        </label>

        <Field label={t('form.notes')} optional>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="form-actions">
          <button className="btn" onClick={closeForm}>
            {t('form.cancel')}
          </button>
          <button className="btn btn-primary" onClick={save}>
            <Icon name="check" size={16} /> {t('form.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
