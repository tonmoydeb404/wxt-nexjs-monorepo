import { delay } from "@/lib"

import type { Commenter } from "./collect-commenters"
import { TYPEAHEAD_OPTION_SELECTOR } from "./selectors"

const TYPEAHEAD_TIMEOUT_MS = 4000

function typeText(editor: HTMLElement, text: string) {
  editor.focus()
  document.execCommand("insertText", false, text)
}

// Typeahead rows show display names (plus optional subtitles) even when a
// slug was typed, so compare on normalized text.
function normalizeText(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim().toLowerCase()
}

// Wait for the typeahead row for this person. Rows are tagged with the
// person's user id (<li id="1000…">), which equals the id in their profile
// link, so an id match always selects exactly the right person — even when
// several people share a display name. Without an id, compare on normalized
// text (rows show display names plus optional subtitles even when a slug was
// typed). Also reports whether any row appeared at all, which tells a skip
// apart: no rows means Facebook doesn't make the person mentionable here,
// rows-but-no-match means an id or name mismatch.
async function waitForOption(
  expectedName: string,
  expectedUserId: string | null,
  requireMatch: boolean,
  signal?: AbortSignal
): Promise<{ option: HTMLElement | null; sawAnyRow: boolean }> {
  const deadline = Date.now() + TYPEAHEAD_TIMEOUT_MS
  const wanted = normalizeText(expectedName)
  let sawAnyRow = false
  while (Date.now() < deadline && !signal?.aborted) {
    const options = Array.from(
      document.querySelectorAll<HTMLElement>(TYPEAHEAD_OPTION_SELECTOR)
    )
    if (options.length > 0) sawAnyRow = true
    if (expectedUserId) {
      const byId = options.find((o) => o.id === expectedUserId)
      if (byId) return { option: byId, sawAnyRow }
    }
    const texts = options.map((o) => normalizeText(o.textContent))
    const exact = texts.indexOf(wanted)
    const partial = texts.findIndex((text) => text.startsWith(wanted))
    const match =
      exact >= 0 ? options[exact] : partial >= 0 ? options[partial] : null
    if (match) return { option: match, sawAnyRow }
    await delay(150)
  }
  if (signal?.aborted) return { option: null, sawAnyRow }
  // A typed slug is precise, so Facebook's top suggestion is trustworthy even
  // when the row text doesn't literally contain the name. A typed display
  // name is ambiguous: never guess a person who doesn't match.
  return {
    option: requireMatch
      ? null
      : (document.querySelector<HTMLElement>(TYPEAHEAD_OPTION_SELECTOR) ??
        null),
    sawAnyRow,
  }
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

// Escape only closes the mention panel; the comment box itself stays intact.
function pressEscape(editor: HTMLElement) {
  for (const type of ["keydown", "keyup"]) {
    editor.dispatchEvent(
      new KeyboardEvent(type, {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      })
    )
  }
}

type TextSlice = { node: Text; start: number }

// Offsets of every text node inside the editor, so a character range in the
// concatenated text can be turned back into a DOM Range.
function textSlices(editor: HTMLElement) {
  const slices: TextSlice[] = []
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
  let start = 0
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!(node instanceof Text)) continue
    slices.push({ node, start })
    start += node.data.length
  }
  return { slices, total: start }
}

// The last occurrence of needle in the editor as a DOM Range plus its index
// in the concatenated text, or null when the text isn't there.
function findLastOccurrence(editor: HTMLElement, needle: string) {
  const { slices } = textSlices(editor)
  const all = slices.map(({ node }) => node.data).join("")
  const index = all.lastIndexOf(needle)
  if (index < 0) return null
  const range = document.createRange()
  let started = false
  for (const { node, start } of slices) {
    const end = start + node.data.length
    if (!started && index < end) {
      range.setStart(node, index - start)
      started = true
    }
    if (index + needle.length <= end) {
      range.setEnd(node, index + needle.length - start)
      return { index, range }
    }
  }
  return null
}

// Remove the "@<handle>" we just typed, wherever the caret ended up. The old
// caret-relative execCommand("delete") loop silently no-ops when focus moved
// or the typeahead re-rendered during the wait, leaking the handle into the
// comment — so re-find the text in the editor and delete that exact range,
// then verify it is actually gone. Returns false when it couldn't be removed.
function eraseTypedHandle(editor: HTMLElement, handle: string) {
  const needle = `@${handle}`
  for (let attempt = 0; attempt < 3; attempt++) {
    const found = findLastOccurrence(editor, needle)
    if (!found) return true
    editor.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(found.range)
    document.execCommand("delete")
    const after = findLastOccurrence(editor, needle)
    // A remaining occurrence before the deleted index is an earlier mention
    // token with the same text; ours is gone.
    if (!after || after.index < found.index) return true
  }
  return false
}

// The text before the caret, measured through the DOM so mention tokens count
// the same way Facebook renders them.
function textBeforeCaret(editor: HTMLElement) {
  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null
  if (!range || !editor.contains(range.startContainer)) return null
  const fromStart = document.createRange()
  fromStart.selectNodeContents(editor)
  fromStart.setEnd(range.startContainer, range.startOffset)
  return fromStart.toString()
}

// Mentions typed flush against other text glue onto it (and Facebook may not
// even open the typeahead), so make sure the caret sits right after whitespace
// or at the very start of the box before typing one. The check is at the
// caret, not at the end of the box, so it also covers a caret the user left
// mid-text.
function ensureSpaceBeforeCaret(editor: HTMLElement) {
  editor.focus()
  const selection = window.getSelection()
  const hasCaret =
    selection != null &&
    selection.rangeCount > 0 &&
    editor.contains(selection.getRangeAt(0).startContainer)
  if (!hasCaret) {
    // No caret in the box: continue from its end.
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
  const before = textBeforeCaret(editor)
  if (before === null) return
  if (before.length === 0 || /\s$/.test(before)) return
  typeText(editor, " ")
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

// Why a person wasn't mentioned.
export type SkipReason =
  // The typeahead never offered anyone: Facebook doesn't make this person
  // mentionable from this account/context (e.g. a non-friend without a
  // username on a normal post).
  | "no-suggestions"
  // Rows appeared, but none matched the person's id or name.
  | "no-match"

export type InsertResult = {
  inserted: number
  skipped: { handle: string; reason: SkipReason }[]
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
  const skipped: { handle: string; reason: SkipReason }[] = []
  const signal = options.signal

  prepareCaret(editor, options.caret ?? null)

  for (const commenter of commenters) {
    if (signal?.aborted) {
      stopped = true
      break
    }
    // No slug (profile.php?id=…, /people/…, group member links) means there is
    // no "@handle": type the display name and let the typeahead's <li id> (or,
    // failing that, an exact name match) pick the right person.
    ensureSpaceBeforeCaret(editor)
    const handle = commenter.username ?? commenter.name
    typeText(editor, `@${handle}`)
    const { option, sawAnyRow } = await waitForOption(
      commenter.name,
      commenter.userId,
      commenter.username == null,
      signal
    )
    if (!option) {
      // A still-open panel turns the leftovers into a live mention query and
      // swallows the next person's typing, so close it before cleaning up.
      if (document.querySelector(TYPEAHEAD_OPTION_SELECTOR)) {
        pressEscape(editor)
        await delay(150)
      }
      // Erase the half-typed "@handle" so it doesn't leak into the comment,
      // even when stopping mid-run.
      const erased = eraseTypedHandle(editor, handle)
      if (signal?.aborted) {
        stopped = true
        break
      }
      const reason: SkipReason = sawAnyRow ? "no-match" : "no-suggestions"
      skipped.push({ handle, reason })
      console.warn(
        `[fb-mention] skipped @${handle} (${
          sawAnyRow
            ? "rows appeared but none matched the id or name"
            : "Facebook offered no suggestions; not mentionable from here"
        })${erased ? "" : " — couldn't remove the typed text"}`,
        commenter
      )
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
