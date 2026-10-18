import { ROW_SELECTORS } from "./selectors"
import type { Contact } from "./types"

export const PHONE_PATTERN = /^\+?[\d\s\-()]{7,}$/

export function findRows(): HTMLElement[] {
  for (const selector of ROW_SELECTORS) {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(selector))
    if (rows.length > 0) return rows
  }
  return []
}

function readName(row: HTMLElement): string {
  const titled = row.querySelector<HTMLElement>("span[title]")
  const fromTitle = titled?.getAttribute("title")?.trim()
  if (fromTitle) return fromTitle

  const auto = row.querySelector<HTMLElement>('span[dir="auto"]')
  return auto?.textContent?.trim() ?? ""
}

export function toContact(row: HTMLElement): Contact | null {
  const name = readName(row)
  if (!name) return null
  // Unsaved contacts show their number as the display name.
  return { name, phone: PHONE_PATTERN.test(name) ? name : "" }
}

export type VisibleRow = { row: HTMLElement; contact: Contact }

/** Rows currently rendered, top to bottom (the list is virtualized). */
export function collectVisible(): VisibleRow[] {
  return findRows()
    .sort(
      (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
    )
    .flatMap((row) => {
      const contact = toContact(row)
      return contact ? [{ row, contact }] : []
    })
}
