import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { useUI, useActiveBankroll, type Tab } from './hooks'
import { fmtMoney } from './lib/format'
import { getLastSeen, markSeen, settledSince, type UnseenSummary } from './lib/notify'
import { useAuth, isSupabaseConfigured } from './auth'
import { startSync, stopSync } from './sync'
import { I18nContext, makeT, useI18n } from './i18n'
import { Dashboard } from './pages/Dashboard'
import { Bets } from './pages/Bets'
import { Analytics } from './pages/Analytics'
import { Settings } from './pages/Settings'
import { Onboarding } from './pages/Onboarding'
import { Landing } from './pages/Landing'
import { Auth } from './pages/Auth'
import { BetForm } from './components/BetForm'
import { BetDetail } from './components/bets'
import { Icon } from './components/Icon'

export default function App() {
  const settings = useStore((s) => s.settings)
  const i18n = useMemo(() => ({ t: makeT(settings.language), lang: settings.language }), [settings.language])
  const init = useAuth((s) => s.init)
  const user = useAuth((s) => s.user)
  const prevUserId = useRef<string | null>(null)

  useEffect(() => {
    init()
  }, [init])

  // Cloud sync: hydrate on login, clear device data on real sign-out.
  useEffect(() => {
    const uid = user?.id ?? null
    if (uid) {
      startSync(uid)
    } else {
      stopSync()
      if (prevUserId.current) useStore.getState().clearData()
    }
    prevUserId.current = uid
  }, [user?.id])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    document.documentElement.lang = settings.language
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#0A0E15' : '#F4F6FA')
  }, [settings.theme, settings.language])

  return (
    <I18nContext.Provider value={i18n}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </I18nContext.Provider>
  )
}

function AppRoutes() {
  const ready = useAuth((s) => s.ready)
  const session = useAuth((s) => s.session)
  const hasBankroll = useStore((s) => s.bankrolls.length > 0)
  const authed = !isSupabaseConfigured || !!session
  const navigate = useNavigate()
  const setScanBlob = useUI((s) => s.setScanBlob)
  const openForm = useUI((s) => s.openForm)

  // Web Share Target (Android): a shared image lands at /?shared=1 → open the app + scan.
  useEffect(() => {
    if (!window.location.search.includes('shared=1') || !('caches' in window)) return
    caches
      .open('stakeo-share')
      .then(async (cache) => {
        const res = await cache.match('/shared-image')
        navigate('/app', { replace: true })
        if (!res) return
        const blob = await res.blob()
        await cache.delete('/shared-image')
        setScanBlob(blob)
        openForm()
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) return <Splash />

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={authed ? <Navigate to="/app" replace /> : <Auth mode="signin" />} />
      <Route path="/signup" element={authed ? <Navigate to="/app" replace /> : <Auth mode="signup" />} />
      <Route path="/app/*" element={authed ? hasBankroll ? <Shell /> : <Onboarding /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function Splash() {
  return (
    <div className="splash">
      <img src="/icon.svg" width="52" height="52" alt="Stakeo" />
      <span className="spinner" />
    </div>
  )
}

function Shell() {
  const { t } = useI18n()
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  const openForm = useUI((s) => s.openForm)
  const formOpen = useUI((s) => s.formOpen)
  const editingId = useUI((s) => s.editingId)
  const detailId = useUI((s) => s.detailId)
  const signOut = useAuth((s) => s.signOut)

  const navItems: { tab: Tab; icon: string; label: string }[] = [
    { tab: 'dashboard', icon: 'home', label: t('nav.dashboard') },
    { tab: 'bets', icon: 'list', label: t('nav.bets') },
    { tab: 'stats', icon: 'chart', label: t('nav.stats') },
    { tab: 'settings', icon: 'settings', label: t('nav.settings') },
  ]

  const navBtn = (n: (typeof navItems)[number]) => (
    <button key={n.tab} className={tab === n.tab ? 'active' : ''} onClick={() => setTab(n.tab)}>
      <Icon name={n.icon} size={20} />
      <span>{n.label}</span>
    </button>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="sidebar-logo" title={t('landing.backToSite')}>
          <img src="/icon.svg" width="30" height="30" alt="" />
          <span>{t('app.name')}</span>
        </Link>
        <button className="btn btn-primary sidebar-add" onClick={() => openForm()}>
          <Icon name="plus" size={16} /> {t('nav.add')}
        </button>
        <nav>{navItems.map(navBtn)}</nav>
        <button className="sidebar-signout" onClick={() => signOut()}>
          <Icon name="logout" size={19} />
          <span>{t('auth.signOut')}</span>
        </button>
      </aside>

      <header className="app-topbar">
        <Link to="/" className="app-topbar-logo" aria-label={t('landing.backToSite')}>
          <img src="/icon.svg" width="26" height="26" alt="" />
          <span>{t('app.name')}</span>
        </Link>
        <button className="icon-btn" onClick={() => signOut()} aria-label={t('auth.signOut')}>
          <Icon name="logout" size={19} />
        </button>
      </header>

      <main className="content">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'bets' && <Bets />}
        {tab === 'stats' && <Analytics />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="bottom-nav">
        {navItems.slice(0, 2).map(navBtn)}
        <button className="fab" onClick={() => openForm()} aria-label={t('nav.add')}>
          <Icon name="plus" size={24} />
        </button>
        {navItems.slice(2).map(navBtn)}
      </nav>

      {formOpen && <BetForm key={editingId || 'new'} />}
      {detailId && <BetDetail />}
      <SettlementToast />
    </div>
  )
}

// "Your bets are settled" recap shown once on open, summarising everything the
// auto-settlement resolved since this device last saw the app.
function SettlementToast() {
  const { t, lang } = useI18n()
  const notify = useStore((s) => s.settings.notifyResults)
  const { bankroll } = useActiveBankroll()
  const setTab = useUI((s) => s.setTab)
  const [summary, setSummary] = useState<UnseenSummary | null>(null)
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current || !notify) return
    // Wait a beat so hydrate + instant cache-settlement have run first.
    const id = setTimeout(() => {
      if (shown.current) return
      shown.current = true
      const s = settledSince(useStore.getState().bets, getLastSeen())
      markSeen()
      if (s.count === 0) return
      setSummary(s)
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const title = s.count === 1 ? t('notify.oneTitle') : t('notify.manyTitle', { n: s.count })
          const net = (s.net >= 0 ? '+' : '') + fmtMoney(s.net, bankroll?.currency || 'EUR', lang)
          new Notification(title, { body: `${t('notify.summary', { won: s.won, lost: s.lost })} · ${net}`, icon: '/icon-192.png' })
        }
      } catch {
        /* system notifications are best-effort */
      }
    }, 2500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!summary) return null
  const cur = bankroll?.currency || 'EUR'
  const net = (summary.net >= 0 ? '+' : '') + fmtMoney(summary.net, cur, lang)
  const title = summary.count === 1 ? t('notify.oneTitle') : t('notify.manyTitle', { n: summary.count })
  const goToBets = () => {
    setTab('bets')
    setSummary(null)
  }
  return (
    <div className="settle-toast" role="status">
      <div className="settle-toast-icon">
        <Icon name="sparkles" size={18} />
      </div>
      <button className="settle-toast-body" onClick={goToBets}>
        <strong>{title}</strong>
        <span>
          {t('notify.summary', { won: summary.won, lost: summary.lost })} ·{' '}
          <b className={summary.net >= 0 ? 'pos' : 'neg'}>{net}</b>
        </span>
      </button>
      <button className="icon-btn settle-toast-close" onClick={() => setSummary(null)} aria-label={t('common.close')}>
        <Icon name="x" size={16} />
      </button>
    </div>
  )
}
