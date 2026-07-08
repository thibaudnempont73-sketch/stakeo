import { useEffect, useReducer } from 'react'

// Chrome/Android fire `beforeinstallprompt` EARLY (near page load), long before
// the user opens Settings. So we capture it at MODULE scope — as soon as this
// file is imported at startup — and keep it, so the install button always has
// the real prompt on hand for a true one-click install.
//
// iOS has no such event (install is manual via Share → Add to Home Screen) and
// can't be a Web Share Target at all — the UI falls back to a how-to there.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // stop Chrome's mini-infobar; we drive the prompt ourselves
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function useInstall() {
  const [, rerender] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    listeners.add(rerender)
    return () => {
      listeners.delete(rerender)
    }
  }, [])

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true)

  const promptInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    deferred = null // a prompt can only be used once
    emit()
  }

  return { canInstall: !!deferred, promptInstall, isIOS, isStandalone }
}
