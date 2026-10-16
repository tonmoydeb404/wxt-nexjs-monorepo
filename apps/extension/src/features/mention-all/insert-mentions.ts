import { delay } from "@/lib"

import type { Commenter } from "./collect-commenters"
import { TYPEAHEAD_OPTION_SELECTOR } from "./selectors"

const TYPEAHEAD_TIMEOUT_MS = 4000

function typeText(editor: HTMLElement, text: string) {
  editor.focus()
  document.execCommand("insertText", false, text)
}

async function waitForOption() {
  const deadline = Date.now() + TYPEAHEAD_TIMEOUT_MS
  while (Date.now() < deadline) {
    const option = document.querySelector<HTMLElement>(
      TYPEAHEAD_OPTION_SELECTOR
    )
    if (option) return option
    await delay(150)
  }
  return null
}

// Enter selects the highlighted suggestion. Only call this while a suggestion
// is visible, otherwise Enter would submit the comment.
function pressEnter(editor: HTMLElement) {
  for (const type of ["keydown", "keypress", "keyup"]) {
    editor.dispatchEvent(
      new KeyboardEvent(type, {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    )
  }
}

export type InsertResult = { inserted: number; skipped: string[] }

export async function insertMentions(
  editor: HTMLElement,
  commenters: Commenter[],
  options: {
    delayMs: number
    onProgress?: (done: number) => void
  }
): Promise<InsertResult> {
  let inserted = 0
  const skipped: string[] = []

  for (const commenter of commenters) {
    const handle = commenter.username
    typeText(editor, `@${handle}`)
    const option = await waitForOption()
    if (!option) {
      // Erase the half-typed "@handle" so it doesn't leak into the comment.
      for (let i = 0; i < handle.length + 1; i++) {
        document.execCommand("delete")
      }
      skipped.push(handle)
      console.warn(`[fb-mention] skipped @${handle}`)
      continue
    }

    pressEnter(editor)
    await delay(200)
    // Fall back to clicking if the suggestion is still open after Enter.
    if (option.isConnected) option.click()
    typeText(editor, " ")
    inserted++
    options.onProgress?.(inserted)
    await delay(options.delayMs)
  }

  return { inserted, skipped }
}
