import { delay } from "@/lib"

import { collectVisible } from "./collect-rows"
import { findScroller } from "./find-scroller"
import { resolvePhone } from "./resolve-phone"
import { downloadCsv } from "./to-csv"
import type { Contact, ExportStatus } from "./types"

const MAX_IDLE_ROUNDS = 4

let status: ExportStatus = { state: "idle", count: 0, message: "" }
let stopRequested = false

export function getStatus(): ExportStatus {
  return status
}

export function stopExport() {
  stopRequested = true
}

/** Extract -> scroll -> extract, until the list stops yielding new contacts. */
export async function startExport(
  scrollDelayMs: number,
  resolvePhones: boolean
) {
  if (status.state === "running") return

  stopRequested = false
  const seen = new Map<string, Contact>()
  status = { state: "running", count: 0, message: "Looking for the list…" }

  const scroller = findScroller()
  if (!scroller) {
    status = {
      state: "error",
      count: 0,
      message: "No list found. Open a WhatsApp list first.",
    }
    return
  }

  async function collect(withPhones: boolean) {
    for (const { row, contact } of collectVisible()) {
      if (stopRequested) return
      if (seen.has(contact.name)) continue
      // Reserve the slot first so a slow lookup is never repeated.
      seen.set(contact.name, contact)
      if (withPhones && !contact.phone) {
        status = {
          state: "running",
          count: seen.size,
          message: `Reading number for ${contact.name}…`,
        }
        contact.phone = await resolvePhone(row)
      }
    }
  }

  scroller.scrollTop = 0
  await delay(scrollDelayMs)

  let idle = 0
  while (!stopRequested && idle < MAX_IDLE_ROUNDS) {
    const before = seen.size
    await collect(resolvePhones)

    const top = scroller.scrollTop
    scroller.scrollBy({ top: scroller.clientHeight * 0.8 })
    await delay(scrollDelayMs)

    const moved = scroller.scrollTop !== top
    idle = seen.size === before && !moved ? idle + 1 : 0
    status = {
      state: "running",
      count: seen.size,
      message: `Collected ${seen.size} contacts…`,
    }
  }

  // Final pass to catch rows rendered by the last scroll.
  await collect(resolvePhones)

  const contacts = Array.from(seen.values())
  if (contacts.length === 0) {
    status = { state: "error", count: 0, message: "No contacts found." }
    return
  }

  downloadCsv(contacts)
  status = {
    state: "done",
    count: contacts.length,
    message: stopRequested
      ? `Stopped. Exported ${contacts.length} contacts.`
      : `Exported ${contacts.length} contacts.`,
  }
}
