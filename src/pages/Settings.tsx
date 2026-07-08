import { useState } from 'react'
import { useI18n, LANGUAGES } from '../i18n'
import { useStore, exportJSON, exportCSV } from '../store'
import { useActiveBankroll, CURRENCIES } from '../hooks'
import { currentBalance } from '../lib/stats'
import { fmtMoney, fmtDate, todayISO } from '../lib/format'
import { Field, Modal, Segmented } from '../components/ui'
import { Icon } from '../components/Icon'
import { useAuth, isSupabaseConfigured } from '../auth'
import { useInstall } from '../lib/pwa'
import type { OddsFormat, StakingMethod, Theme } from '../types'

function download(filename: string, content: string, mime: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: mime }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const parseNum = (s: string) => parseFloat(s.replace(',', '.'))

export function Settings() {
  const { t, lang } = useI18n()
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const resetAll = useStore((s) => s.resetAll)
  const setActiveBankroll = useStore((s) => s.setActiveBankroll)
  const allBets = useStore((s) => s.bets)
  const allTxs = useStore((s) => s.transactions)
  const { bankroll, bankrolls } = useActiveBankroll()
  const [managing, setManaging] = useState<string | 'new' | null>(null)
  const authUser = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)
  const { canInstall, promptInstall, isIOS, isStandalone } = useInstall()
  const [notifPerm, setNotifPerm] = useState<string>(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
      </header>

      <section className="card settings-card share-card">
        <h2 className="card-title">{t('settings.share')}</h2>
        <p className="field-hint">{t('settings.shareHint')}</p>
        {canInstall && (
          <button className="btn btn-primary" onClick={promptInstall}>
            <Icon name="download" size={16} /> {t('settings.installApp')}
          </button>
        )}
        <p className="field-hint share-platform">{isIOS ? t('settings.shareIos') : t('settings.shareAndroid')}</p>
        {isStandalone && <p className="field-hint share-ok">✓ {t('settings.shareInstalled')}</p>}
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.general')}</h2>
        <Field label={t('settings.language')}>
          <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('settings.theme')}>
          <Segmented<Theme>
            options={[
              { value: 'dark', label: t('settings.dark') },
              { value: 'light', label: t('settings.light') },
            ]}
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
          />
        </Field>
        <Field label={t('settings.oddsFormat')}>
          <select value={settings.oddsFormat} onChange={(e) => updateSettings({ oddsFormat: e.target.value as OddsFormat })}>
            <option value="decimal">{t('odds.decimal')}</option>
            <option value="american">{t('odds.american')}</option>
            <option value="fractional">{t('odds.fractional')}</option>
          </select>
        </Field>
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.staking')}</h2>
        <Field label={t('settings.method')}>
          <select value={settings.stakingMethod} onChange={(e) => updateSettings({ stakingMethod: e.target.value as StakingMethod })}>
            <option value="fixed">{t('staking.fixed')}</option>
            <option value="percent">{t('staking.percent')}</option>
            <option value="kelly">{t('staking.kelly')}</option>
          </select>
        </Field>
        {settings.stakingMethod === 'fixed' && (
          <Field label={`${t('settings.fixedStake')} (${bankroll?.currency || 'EUR'})`}>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.fixedStake}
              onChange={(e) => updateSettings({ fixedStake: Math.max(0, Number(e.target.value)) })}
            />
          </Field>
        )}
        {settings.stakingMethod === 'percent' && (
          <Field label={t('settings.percentStake')}>
            <input
              type="number"
              min="0.1"
              max="25"
              step="0.5"
              value={settings.percentStake}
              onChange={(e) => updateSettings({ percentStake: Math.min(25, Math.max(0.1, Number(e.target.value))) })}
            />
          </Field>
        )}
        {settings.stakingMethod === 'kelly' && (
          <Field label={t('settings.kellyFraction')} hint={t('settings.kellyHint')}>
            <select value={settings.kellyFraction} onChange={(e) => updateSettings({ kellyFraction: Number(e.target.value) })}>
              <option value={1}>Kelly</option>
              <option value={0.5}>1/2 Kelly</option>
              <option value={0.25}>1/4 Kelly</option>
              <option value={0.1}>1/10 Kelly</option>
            </select>
          </Field>
        )}
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.discipline')}</h2>
        <Field label={`${t('settings.stopLoss')} (${bankroll?.currency || 'EUR'})`} hint={t('settings.stopLossHint')}>
          <input
            type="number"
            min="0"
            step="5"
            value={settings.stopLossDaily}
            onChange={(e) => updateSettings({ stopLossDaily: Math.max(0, Number(e.target.value)) })}
          />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={settings.tiltAlert} onChange={(e) => updateSettings({ tiltAlert: e.target.checked })} />
          <div>
            <span>{t('settings.tiltAlert')}</span>
            <span className="field-hint">{t('settings.tiltHint')}</span>
          </div>
        </label>
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.notifications')}</h2>
        <label className="check-row">
          <input type="checkbox" checked={settings.notifyResults} onChange={(e) => updateSettings({ notifyResults: e.target.checked })} />
          <div>
            <span>{t('settings.notifyResults')}</span>
            <span className="field-hint">{t('settings.notifyResultsHint')}</span>
          </div>
        </label>
        {'Notification' in window &&
          (notifPerm === 'granted' ? (
            <p className="field-hint share-ok">✓ {t('settings.notifOn')}</p>
          ) : (
            <button
              className="btn"
              onClick={() => Notification.requestPermission().then((p) => setNotifPerm(p))}
            >
              <Icon name="alert" size={16} /> {t('settings.enableNotif')}
            </button>
          ))}
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.bankrolls')}</h2>
        <div className="bankroll-list">
          {bankrolls.map((b) => {
            const bal = currentBalance(
              allBets.filter((x) => x.bankrollId === b.id),
              allTxs.filter((x) => x.bankrollId === b.id),
              b.startingCapital
            )
            return (
              <div key={b.id} className={`bankroll-row${b.id === bankroll?.id ? ' active' : ''}`}>
                <button className="bankroll-pick" onClick={() => setActiveBankroll(b.id)}>
                  <span className="bankroll-row-name">
                    {b.name}
                    {b.id === bankroll?.id && <em> · {t('settings.active')}</em>}
                  </span>
                  <span className="bankroll-row-bal">{fmtMoney(bal, b.currency, lang)}</span>
                </button>
                <button className="icon-btn" onClick={() => setManaging(b.id)} aria-label={t('bets.edit')}>
                  <Icon name="edit" size={16} />
                </button>
              </div>
            )
          })}
        </div>
        <button className="btn" onClick={() => setManaging('new')}>
          <Icon name="plus" size={16} /> {t('settings.newBankroll')}
        </button>
      </section>

      <section className="card settings-card">
        <h2 className="card-title">{t('settings.data')}</h2>
        <p className="field-hint">{t('settings.dataSynced')}</p>
        <div className="data-actions">
          <button className="btn" onClick={() => download('stakeo-data.json', exportJSON(), 'application/json')}>
            <Icon name="download" size={16} /> {t('settings.exportJson')}
          </button>
          {bankroll && (
            <button className="btn" onClick={() => download('stakeo-bets.csv', exportCSV(bankroll.id), 'text/csv')}>
              <Icon name="download" size={16} /> {t('settings.exportCsv')}
            </button>
          )}
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm(t('settings.resetConfirm'))) resetAll()
            }}
          >
            <Icon name="trash" size={16} /> {t('settings.reset')}
          </button>
        </div>
      </section>

      {isSupabaseConfigured && authUser && (
        <section className="card settings-card">
          <h2 className="card-title">{t('auth.account')}</h2>
          <div className="account-row">
            <div className="account-avatar">
              <Icon name="user" size={18} />
            </div>
            <span className="account-email">{authUser.email}</span>
          </div>
          <button className="btn" onClick={() => signOut()}>
            <Icon name="arrowLeft" size={16} /> {t('auth.signOut')}
          </button>
        </section>
      )}

      <section className="card settings-card about-card">
        <h2 className="card-title">{t('settings.about')}</h2>
        <div className="about-row">
          <Icon name="shield" size={20} />
          <p>{t('settings.aboutText')}</p>
        </div>
        <p className="field-hint">Stakeo v0.2.0</p>
      </section>

      {managing && <BankrollModal id={managing === 'new' ? null : managing} onClose={() => setManaging(null)} />}
    </div>
  )
}

function BankrollModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, lang } = useI18n()
  const bankrolls = useStore((s) => s.bankrolls)
  const createBankroll = useStore((s) => s.createBankroll)
  const updateBankroll = useStore((s) => s.updateBankroll)
  const deleteBankroll = useStore((s) => s.deleteBankroll)
  const transactions = useStore((s) => s.transactions)
  const addTransaction = useStore((s) => s.addTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)

  const bk = id ? bankrolls.find((b) => b.id === id) : undefined
  const [name, setName] = useState(bk?.name || '')
  const [currency, setCurrency] = useState(bk?.currency || 'EUR')
  const [capital, setCapital] = useState(bk ? String(bk.startingCapital) : '')
  const [txAmount, setTxAmount] = useState('')
  const [txNote, setTxNote] = useState('')

  const txs = id ? transactions.filter((x) => x.bankrollId === id).sort((a, b) => b.date.localeCompare(a.date)) : []

  const save = () => {
    const cap = parseNum(capital)
    const finalName = name.trim() || t('onboarding.bankrollNamePh')
    const finalCap = isFinite(cap) && cap >= 0 ? cap : 0
    if (bk) updateBankroll(bk.id, { name: finalName, currency, startingCapital: finalCap })
    else createBankroll(finalName, currency, finalCap)
    onClose()
  }

  const addTx = (type: 'deposit' | 'withdrawal') => {
    if (!id) return
    const amount = parseNum(txAmount)
    if (!isFinite(amount) || amount <= 0) return
    addTransaction({ bankrollId: id, type, amount, date: todayISO(), note: txNote.trim() || undefined })
    setTxAmount('')
    setTxNote('')
  }

  return (
    <Modal open onClose={onClose} title={bk ? bk.name : t('settings.newBankroll')}>
      <div className="form-grid">
        <Field label={t('settings.name')}>
          <input type="text" placeholder={t('onboarding.bankrollNamePh')} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="form-row">
          <Field label={t('settings.currency')}>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('settings.startingCapital')}>
            <input type="text" inputMode="decimal" value={capital} onChange={(e) => setCapital(e.target.value)} />
          </Field>
        </div>

        {bk && (
          <div className="tx-box">
            <span className="field-label">{t('settings.transactions')}</span>
            <div className="tx-add">
              <input
                type="text"
                inputMode="decimal"
                placeholder={t('settings.amount')}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
              />
              <input type="text" placeholder={t('settings.note')} value={txNote} onChange={(e) => setTxNote(e.target.value)} />
            </div>
            <div className="tx-btns">
              <button className="btn btn-sm" onClick={() => addTx('deposit')}>
                <Icon name="download" size={15} /> {t('settings.deposit')}
              </button>
              <button className="btn btn-sm" onClick={() => addTx('withdrawal')}>
                <Icon name="upload" size={15} /> {t('settings.withdrawal')}
              </button>
            </div>
            {txs.length === 0 ? (
              <p className="field-hint">{t('settings.noTx')}</p>
            ) : (
              <div className="tx-list">
                {txs.map((x) => (
                  <div key={x.id} className="tx-row">
                    <span className={x.type === 'deposit' ? 'pos' : 'neg'}>
                      {x.type === 'deposit' ? '+' : '−'}
                      {fmtMoney(x.amount, bk.currency, lang)}
                    </span>
                    <span className="tx-meta">
                      {fmtDate(x.date, lang)}
                      {x.note ? ` · ${x.note}` : ''}
                    </span>
                    <button className="icon-btn" onClick={() => deleteTransaction(x.id)} aria-label={t('common.delete')}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          {bk && bankrolls.length > 1 && (
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm(t('settings.deleteBankrollConfirm'))) {
                  deleteBankroll(bk.id)
                  onClose()
                }
              }}
            >
              {t('settings.deleteBankroll')}
            </button>
          )}
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={save}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
