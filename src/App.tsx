import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store'
import { useUI, type Tab } from './hooks'
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
  const hasBankroll = useStore((s) => s.bankrolls.length > 0)
  const i18n = useMemo(() => ({ t: makeT(settings.language), lang: settings.language }), [settings.language])

  const session = useAuth((s) => s.session)
  const ready = useAuth((s) => s.ready)
  const init = useAuth((s) => s.init)
  const user = useAuth((s) => s.user)
  const [showAuth, setShowAuth] = useState(false)
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

  // Reset the transient auth-screen flag once a session lands.
  useEffect(() => {
    if (session) setShowAuth(false)
  }, [session])

  let view: React.ReactNode
  if (!ready) {
    view = <Splash />
  } else if (isSupabaseConfigured && !session) {
    // SaaS gating: no access without a verified account.
    view = showAuth ? <Auth onBack={() => setShowAuth(false)} /> : <Landing onEnter={() => setShowAuth(true)} />
  } else {
    view = hasBankroll ? <Shell /> : <Onboarding />
  }

  return <I18nContext.Provider value={i18n}>{view}</I18nContext.Provider>
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
  const setScanBlob = useUI((s) => s.setScanBlob)

  useEffect(() => {
    if (!window.location.search.includes('shared=1') || !('caches' in window)) return
    window.history.replaceState(null, '', '/')
    caches
      .open('stakeo-share')
      .then(async (cache) => {
        const res = await cache.match('/shared-image')
        if (!res) return
        const blob = await res.blob()
        await cache.delete('/shared-image')
        setScanBlob(blob)
        openForm()
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <div className="sidebar-logo">
          <img src="/icon.svg" width="30" height="30" alt="" />
          <span>{t('app.name')}</span>
        </div>
        <button className="btn btn-primary sidebar-add" onClick={() => openForm()}>
          <Icon name="plus" size={16} /> {t('nav.add')}
        </button>
        <nav>{navItems.map(navBtn)}</nav>
      </aside>

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
    </div>
  )
}
