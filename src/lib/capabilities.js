// Server-verified capability checks — see src-tauri/src/entitlements.rs.
// `useCapability(id)` is COSMETIC ONLY: it decides whether a feature's UI
// renders or shows an upsell. It is never the actual authorization check —
// that happens server-side, on every request that touches Croco's
// infrastructure, independent of whatever this returns. A user who forges
// a `true` here (patched binary, dev tools, anything) gets a button that
// produces a 403, nothing more.

import { useEffect, useState } from 'react'

let cachedCapabilities = null // null = not loaded yet; [] is a valid "no capabilities" result
let lastRefreshAt = 0
const REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours, matches the brief's "every few hours"

async function ensureFresh() {
  if (!window.api?.entitlements) return
  if (cachedCapabilities === null) {
    // First read is local-only (no network wait) so the UI never blocks
    // on this — same instant-from-cache principle as useData().
    const local = await window.api.entitlements.get().catch(() => ({ capabilities: [] }))
    cachedCapabilities = local?.capabilities || []
  }
  const now = Date.now()
  if (now - lastRefreshAt > REFRESH_INTERVAL_MS) {
    lastRefreshAt = now
    // Network call — failure is expected and fine (offline, server down,
    // no GitHub login yet). Whatever was already cached stays in effect
    // until its own signature-checked expiry, per the entitlements design.
    window.api.entitlements.refresh()
      .then(r => { if (r?.capabilities) cachedCapabilities = r.capabilities })
      .catch(() => {})
  }
}

/** True only if the server has verified this account holds `capability`. */
export function useCapability(capability) {
  const [has, setHas] = useState(() => cachedCapabilities?.includes(capability) ?? false)
  useEffect(() => {
    let cancelled = false
    ensureFresh().then(() => { if (!cancelled) setHas(cachedCapabilities?.includes(capability) ?? false) })
    return () => { cancelled = true }
  }, [capability])
  return has
}

/** Call once on app launch to kick off the first network refresh immediately, rather than waiting for a useCapability() consumer to mount. */
export function refreshCapabilitiesOnLaunch() {
  lastRefreshAt = 0
  return ensureFresh()
}
