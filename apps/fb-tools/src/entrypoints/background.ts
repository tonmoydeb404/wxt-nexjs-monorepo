import { createClerkClient } from "@clerk/chrome-extension/client"

import {
  ACCESS_CHECK_ALARM,
  ACCESS_CHECK_INTERVAL_MINUTES,
  DEFAULT_SETTINGS,
  accessStateItem,
  ensureDeviceClaimed,
  isDeviceAllowed,
  isExtensionEnabled,
  isGetAccessStateMessage,
  settingsItem,
  type AccessState,
} from "@/lib"

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

type ClerkClient = Awaited<ReturnType<typeof createClerkClient>>

let clerkPromise: Promise<ClerkClient> | null = null

// A single Clerk instance for the service worker. The background:true option
// lets it refresh the session token even when the popup is closed. A failed
// init (e.g. before the user ever signed in) must not be cached forever, so
// the promise is dropped on rejection and the next call retries.
function getClerk(): Promise<ClerkClient> {
  if (!clerkPromise) {
    if (!publishableKey) {
      throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY")
    }
    clerkPromise = createClerkClient({
      publishableKey,
      background: true,
    }).catch((error) => {
      clerkPromise = null
      throw error
    })
  }
  return clerkPromise
}

async function getAccessState(): Promise<AccessState> {
  if (!publishableKey) {
    return { signedIn: false, enabled: false, blocked: null, userId: null }
  }
  try {
    const clerk = await getClerk()
    if (!clerk.session || !clerk.user) {
      return { signedIn: false, enabled: false, blocked: null, userId: null }
    }
    // Bind the account to this browser profile if no device is claimed yet.
    await ensureDeviceClaimed(clerk.user)
    const allowed = await isDeviceAllowed(clerk.user.unsafeMetadata)
    const revoked = !isExtensionEnabled(clerk.user.publicMetadata)
    const blocked = allowed ? (revoked ? "revoked" : null) : "device"
    return {
      signedIn: true,
      enabled: blocked === null,
      blocked,
      userId: clerk.user.id,
    }
  } catch (error) {
    console.error("[background] Failed to resolve access state:", error)
    return { signedIn: false, enabled: false, blocked: null, userId: null }
  }
}

// Re-check and broadcast on change, so open Facebook tabs react immediately
// (e.g. after the flag is flipped in the Clerk dashboard).
async function refreshAccessState() {
  const next = await getAccessState()
  const previous = await accessStateItem.getValue()
  await accessStateItem.setValue(next)
  if (
    previous?.signedIn !== next.signedIn ||
    previous?.enabled !== next.enabled ||
    previous?.blocked !== next.blocked ||
    previous?.userId !== next.userId
  ) {
    await browser.runtime
      .sendMessage({ type: "access-state-changed", state: next })
      .catch(() => {
        // No receiver (no open Facebook tabs or popup): nothing to broadcast.
      })
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const current = await settingsItem.getValue()
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, ...current })
  })

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isGetAccessStateMessage(message)) return
    void getAccessState().then(async (state) => {
      await accessStateItem.setValue(state)
      sendResponse({ state })
    })
    return true
  })

  browser.alarms.create(ACCESS_CHECK_ALARM, {
    periodInMinutes: ACCESS_CHECK_INTERVAL_MINUTES,
  })
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ACCESS_CHECK_ALARM) void refreshAccessState()
  })

  void refreshAccessState()
})
