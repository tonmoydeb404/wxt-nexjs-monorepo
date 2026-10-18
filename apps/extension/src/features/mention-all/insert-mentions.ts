import { delay } from "@/lib"

import type { Commenter } from "./collect-commenters"
import { TYPEAHEAD_OPTION_SELECTOR } from "./selectors"

const TYPEAHEAD_TIMEOUT_MS = 4000

function typeText(editor: HTMLElement, text: string) {
  editor.focus()
  document.execCommand("insertText", false, text)
}

async function waitForOption(signal?: AbortSignal) {
  const deadline = Date.now() + TYPEAHEAD_TIMEOUT_MS
  while (Date.now() < deadline && !signal?.aborted) {
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

// Put the caret at the end of the line it was in (or the end of the text when
// it wasn't in the box), and add a space first if the line doesn't end in one,
// so the first mention never glues onto the previous word.
function prepareCaret(editor: HTMLElement, saved: Range | null) {
  editor.focus()
  const anchor =
    saved && editor.contains(saved.endContainer)
      ? saved.endContainer
      : editor.lastChild
  let block: Node | null = anchor
  while (block && block.parentNode !== editor) block = block.parentNode
  const line = block ?? editor

  const range = document.createRange()
  range.selectNodeContents(line)
  const text = line.textContent ?? ""
  if (text) range.collapse(false)
  else range.collapse(true)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)

  if (text && !/\s$/.test(text)) typeText(editor, " ")
}

export type InsertResult = {
  inserted: number
  skipped: string[]
  stopped: boolean
}

export async function insertMentions(
  editor: HTMLElement,
  commenters: Commenter[],
  options: {
    // Getter, so popup changes apply to the very next mention.
    getDelayMs: () => number
    // Caret the user had in the box before pressing the button.
    caret?: Range | null
    signal?: AbortSignal
    // Called right after each person is inserted, before the next one.
    onInserted?: (commenter: Commenter, done: number) => void | Promise<void>
  }
): Promise<InsertResult> {
  let inserted = 0
  let stopped = false
  const skipped: string[] = []
  const signal = options.signal

  prepareCaret(editor, options.caret ?? null)

  for (const commenter of commenters) {
    if (signal?.aborted) {
      stopped = true
      break
    }
    const handle = commenter.username
    typeText(editor, `@${handle}`)
    const option = await waitForOption(signal)
    if (!option) {
      // Erase the half-typed "@handle" so it doesn't leak into the comment.
      for (let i = 0; i < handle.length + 1; i++) {
        document.execCommand("delete")
      }
      if (signal?.aborted) {
        stopped = true
        break
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
    await options.onInserted?.(commenter, inserted)
    await delay(options.getDelayMs())
  }

  return { inserted, skipped, stopped }
}
