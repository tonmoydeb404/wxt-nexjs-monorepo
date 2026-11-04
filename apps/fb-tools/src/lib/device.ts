import { storage } from "wxt/utils/storage"

// Each account is locked to a single browser profile. A random id is
// generated once per profile and stored locally; the account's user records
// a SHA-256 hash of that id in unsafeMetadata (the only metadata field the
// client can write). Only the hash is stored in metadata so the raw id
// cannot be copied to another browser from there. Clearing the hash from
// the Clerk dashboard moves the account to whichever device signs in next.
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

async function hashDeviceId(deviceId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(deviceId),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function readStoredLock(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): string | null {
  const stored = unsafeMetadata?.[DEVICE_METADATA_KEY]
  return typeof stored === "string" && stored.length > 0 ? stored : null
}

function isUnclaimed(value: unknown): boolean {
  return value === undefined || value === null
}

// True when the stored lock matches this device — by hash, or by raw id for
// claims made by older versions.
async function matchesDeviceLock(
  stored: string,
  deviceId: string,
): Promise<boolean> {
  return stored === (await hashDeviceId(deviceId)) || stored === deviceId
}

// True when the account is not locked anywhere, or is locked to this device.
export async function isDeviceAllowed(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const stored = readStoredLock(unsafeMetadata)
  if (stored === null) return true
  return matchesDeviceLock(stored, await getDeviceId())
}

export function isDeviceLocked(
  unsafeMetadata: Record<string, unknown> | null | undefined,
): boolean {
  return readStoredLock(unsafeMetadata) !== null
}

type ClaimableUser = {
  unsafeMetadata: Record<string, unknown>
  updateMetadata: (params: {
    unsafeMetadata: Record<string, unknown>
  }) => Promise<unknown>
}

// Bind the account to this device if it is still unclaimed, upgrading older
// raw-id claims to hashed ones. Returns false when the account is already
// locked to another device.
export async function ensureDeviceClaimed(
  user: ClaimableUser,
): Promise<boolean> {
  const deviceId = await getDeviceId()
  const stored = readStoredLock(user.unsafeMetadata)
  if (stored !== null) {
    if (!(await matchesDeviceLock(stored, deviceId))) return false
    if (stored === deviceId) {
      // Legacy raw-id claim: upgrade it to the hashed form.
      try {
        await user.updateMetadata({
          unsafeMetadata: {
            [DEVICE_METADATA_KEY]: await hashDeviceId(deviceId),
          },
        })
      } catch {
        // The upgrade is cosmetic; this device still matches.
      }
    }
    return true
  }
  try {
    // updateMetadata deep-merges, so any other unsafe metadata is preserved.
    await user.updateMetadata({
      unsafeMetadata: { [DEVICE_METADATA_KEY]: await hashDeviceId(deviceId) },
    })
  } catch {
    // Write failed: fall back to whatever the current lock state is.
    return isUnclaimed(user.unsafeMetadata[DEVICE_METADATA_KEY])
  }
  return (
    readStoredLock(user.unsafeMetadata) === (await hashDeviceId(deviceId))
  )
}
