import { browser } from "wxt/browser"

import { storage } from "wxt/utils/storage"

// How often the background worker re-checks the signed-in user's access flag.
export const ACCESS_CHECK_ALARM = "check-access"
export const ACCESS_CHECK_INTERVAL_MINUTES = 5

// Clerk user public metadata key that gates extension usage. Set it to false
// from the Clerk dashboard (Users -> user -> Public metadata) to disable a user.
export const EXTENSION_ACCESS_KEY = "extension_access"

export type AccessState = {
  signedIn: boolean
  enabled: boolean
  userId: string | null
  // Why access is disabled, if it is.
  blocked: "revoked" | "device" | null
}

// Last known state, so any context can read it without a live Clerk check.
export const accessStateItem = storage.defineItem<AccessState | null>(
  "local:accessState",
  { fallback: null },
)

export type GetAccessStateMessage = { type: "get-access-state" }
export type GetAccessStateResponse = { state: AccessState | null }
export type AccessStateChangedMessage = {
  type: "access-state-changed"
  state: AccessState
}

// A user can use the extension unless the flag is explicitly set to false.
export function isExtensionEnabled(
  publicMetadata: Record<string, unknown> | null | undefined,
): boolean {
  return publicMetadata?.[EXTENSION_ACCESS_KEY] !== false
}

export function isGetAccessStateMessage(
  message: unknown,
): message is GetAccessStateMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "get-access-state"
  )
}

export function isGetAccessStateResponse(
  value: unknown,
): value is GetAccessStateResponse {
  return typeof value === "object" && value !== null && "state" in value
}

export function isAccessStateChangedMessage(
  message: unknown,
): message is AccessStateChangedMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "access-state-changed" &&
    "state" in message
  )
}

// Clerk cannot run inside a content script (origin restrictions), so content
// scripts ask the background service worker for the current access state.
export async function requestAccessState(): Promise<AccessState | null> {
  try {
    const response: unknown = await browser.runtime.sendMessage({
      type: "get-access-state",
    } satisfies GetAccessStateMessage)
    return isGetAccessStateResponse(response) ? response.state : null
  } catch {
    // Background worker unreachable or no receiver for the broadcast.
    return null
  }
}

// Listen for broadcasts from the background worker (e.g. access revoked from
// the Clerk dashboard while a Facebook tab is open).
export function watchAccessState(onChange: (state: AccessState) => void) {
  const listener = (message: unknown) => {
    if (isAccessStateChangedMessage(message)) onChange(message.state)
  }
  browser.runtime.onMessage.addListener(listener)
  return () => {
    browser.runtime.onMessage.removeListener(listener)
  }
}
