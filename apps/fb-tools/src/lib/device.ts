import { browser } from "wxt/browser"

import { storage } from "wxt/utils/storage"

// Each account is locked to a single browser profile. A random id is
// generated once per profile and stored locally; the signed-in user records
// the id it is bound to in unsafeMetadata (the only metadata field the
// client can write). Clearing that field from the Clerk dashboard moves the
// account to whichever device signs in next.
export const DEVICE_METADATA_KEY = "device_id"

const deviceIdItem = storage.defineItem<string | null>("local:deviceId", {
  fallback: null,
})

export async function getDeviceId(): Promise<string> {
  let id = await deviceIdItem.getValue()
  if (!id) {
    id = crypto.randomUUID()
    await deviceIdItem.setValue(id)
  }
  return id
}

function readLockedId(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): string | null {
  const lockedId = unsafeMetadata?.[DEVICE_METADATA_KEY]
  return typeof lockedId === "string" && lockedId.length > 0 ? lockedId : null
}

function isUnclaimed(value: unknown): boolean {
  return value === undefined || value === null
}

// True when the account is not locked anywhere, or is locked to this device.
export async function isDeviceAllowed(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const lockedId = readLockedId(unsafeMetadata)
  if (lockedId === null) return true
  return lockedId === (await getDeviceId())
}

export function isDeviceLocked(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): boolean {
  return readLockedId(unsafeMetadata) !== null
}

type ClaimableUser = {
  unsafeMetadata: Record<string, unknown>
  updateMetadata: (params: {
    unsafeMetadata: Record<string, unknown>
  }) => Promise<unknown>
}

// Bind the account to this device if it is still unclaimed. Returns false
// when the account is already locked to another device.
export async function ensureDeviceClaimed(
  user: ClaimableUser,
): Promise<boolean> {
  const deviceId = await getDeviceId()
  const lockedId = readLockedId(user.unsafeMetadata)
  if (lockedId === deviceId) return true
  if (lockedId !== null) return false
  try {
    // updateMetadata deep-merges, so any other unsafe metadata is preserved.
    await user.updateMetadata({
      unsafeMetadata: { [DEVICE_METADATA_KEY]: deviceId },
    })
  } catch {
    // Write failed: fall back to whatever the current lock state is.
    return isUnclaimed(user.unsafeMetadata[DEVICE_METADATA_KEY])
  }
  return readLockedId(user.unsafeMetadata) === deviceId
}
