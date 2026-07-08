import { useStore } from './store'
import { isSupabaseConfigured } from './lib/supabase'
import { fetchAll, pushAll } from './lib/db'
import { settleFromCache } from './lib/settleLocal'

let currentUserId: string | null = null
let hydrating = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let subscribed = false

export type SyncState = 'idle' | 'syncing' | 'error'

async function hydrate(userId: string) {
  hydrating = true
  try {
    const cloud = await fetchAll(userId)
    const local = useStore.getState()
    const cloudEmpty = cloud.bankrolls.length === 0
    if (cloudEmpty && local.bankrolls.length > 0) {
      // First login with pre-existing local data → migrate it up to the cloud.
      await pushAll(userId, {
        bankrolls: local.bankrolls,
        bets: local.bets,
        transactions: local.transactions,
      })
    } else {
      // Adopt the cloud as the source of truth for this device.
      useStore.setState({
        bankrolls: cloud.bankrolls,
        bets: cloud.bets,
        transactions: cloud.transactions,
        activeBankrollId: cloud.bankrolls.some((b) => b.id === local.activeBankrollId)
          ? local.activeBankrollId
          : (cloud.bankrolls[0]?.id ?? ''),
      })
    }
  } catch (err) {
    // Tables not created yet, or offline → keep working locally, sync later.
    console.warn('[stakeo] cloud sync unavailable, staying local:', (err as Error).message)
  } finally {
    hydrating = false
  }
}

function schedulePush() {
  if (!currentUserId || hydrating) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    const uid = currentUserId
    if (!uid) return
    const s = useStore.getState()
    pushAll(uid, { bankrolls: s.bankrolls, bets: s.bets, transactions: s.transactions }).catch((err) => {
      console.warn('[stakeo] cloud push failed:', (err as Error).message)
    })
  }, 1200)
}

export function startSync(userId: string) {
  if (!isSupabaseConfigured) return
  currentUserId = userId
  if (!subscribed) {
    subscribed = true
    useStore.subscribe(schedulePush)
  }
  // Hydrate from cloud, then settle any finished bets instantly from the
  // shared results cache (free, no wait for the cron). Best-effort.
  hydrate(userId).then(() => settleFromCache().catch(() => {}))
}

export function stopSync() {
  currentUserId = null
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
}
