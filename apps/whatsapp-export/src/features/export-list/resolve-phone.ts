import { delay } from "@/lib"

import { PHONE_PATTERN } from "./collect-rows"
import { PANE_SELECTOR } from "./selectors"

const POLL_MS = 150
const WAIT_MS = 2500

function press(el: HTMLElement) {
  for (const type of ["mousedown", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
  }
}

/**
 * First phone-like text outside the chat list: the contact-info drawer (and
 * the chat header for unsaved numbers). Message bubbles are ignored.
 */
function readPhone(): string {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ""
    if (!PHONE_PATTERN.test(text)) continue
    const el = node.parentElement
    if (!el || el.closest(PANE_SELECTOR)) continue
    if (el.closest("#main") && !el.closest("#main header")) continue
    return text
  }
  return ""
}

async function waitForPhone(previous: string, timeoutMs: number) {
  for (let waited = 0; waited < timeoutMs; waited += POLL_MS) {
    const phone = readPhone()
    if (phone && phone !== previous) return phone
    await delay(POLL_MS)
  }
  return ""
}

let lastPhone = ""

/** Open the chat for `row`, then its contact info, and read the number. */
export async function resolvePhone(row: HTMLElement): Promise<string> {
  const target =
    row.querySelector<HTMLElement>('[data-testid="cell-frame-container"]') ??
    row
  press(target)

  // The drawer may stay open and update when switching chats.
  let phone = await waitForPhone(lastPhone, 800)
  if (!phone) {
    const header = document.querySelector<HTMLElement>("#main header")
    const title =
      header?.querySelector<HTMLElement>('span[dir="auto"]') ?? header
    if (title) press(title)
    phone = await waitForPhone(lastPhone, WAIT_MS)
  }

  if (phone) lastPhone = phone
  return phone
}
