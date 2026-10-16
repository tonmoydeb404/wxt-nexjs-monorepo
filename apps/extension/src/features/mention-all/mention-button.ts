import { settingsItem } from "@/lib"

import {
  expandComments,
  filterCommenters,
  readCommenters,
} from "./collect-commenters"
import { insertMentions } from "./insert-mentions"
import {
  COMMENT_EDITOR_SELECTOR,
  COMMENT_OR_REPLY_SELECTOR,
  COMMENT_SELECTOR,
} from "./selectors"

const IDLE_LABEL = "Mention all commenters"

const BUTTON_STYLE = `
  :host { all: initial }
  button {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    padding: 10px 16px;
    border: 0;
    border-radius: 999px;
    background: #0866ff;
    color: #fff;
    font: 600 13px system-ui, sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
  }
  button:disabled { opacity: 0.7; cursor: progress }
`

function findMainEditors() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(COMMENT_EDITOR_SELECTOR)
  ).filter((editor) => !editor.closest(COMMENT_OR_REPLY_SELECTOR))
}

function isInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return rect.bottom > 0 && rect.top < window.innerHeight
}

// Prefer the box the user last focused, then one on screen, then any.
function pickEditor(lastFocused: HTMLElement | null) {
  const editors = findMainEditors()
  if (lastFocused && editors.includes(lastFocused)) return lastFocused
  return editors.find(isInViewport) ?? editors[0] ?? null
}

// Walk up from the comment box to the closest container that holds comments.
function findCommentsScope(editor: HTMLElement) {
  let node = editor.parentElement
  while (node && !node.querySelector(COMMENT_SELECTOR))
    node = node.parentElement
  return node ?? document.body
}

async function run(
  editor: HTMLElement,
  button: HTMLButtonElement,
  setLabel: (text: string) => void
) {
  const settings = await settingsItem.getValue()

  setLabel("Loading comments…")
  const scope = findCommentsScope(editor)
  await expandComments(scope, settings.delayMs)

  const commenters = filterCommenters(
    readCommenters(scope),
    settings.excludeNames
  ).slice(0, settings.batchSize)
  console.log(`[fb-mention] found ${commenters.length} commenters`, commenters)

  if (commenters.length === 0) {
    setLabel("No commenters found (see console)")
    return
  }

  if (settings.dryRun) {
    setLabel(`Dry run: ${commenters.length} found`)
    return
  }

  const result = await insertMentions(editor, commenters, {
    delayMs: settings.delayMs,
    onProgress: (done) => {
      setLabel(`Mentioning ${done}/${commenters.length}…`)
    },
  })

  setLabel(
    `Done: ${result.inserted} mentioned` +
      (result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : "") +
      ". Press Enter to post."
  )
}

export function mountMentionButtons() {
  const host = document.createElement("div")
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = BUTTON_STYLE
  const button = document.createElement("button")
  button.textContent = IDLE_LABEL
  shadow.append(style, button)

  let lastFocused: HTMLElement | null = null
  let resetTimer: ReturnType<typeof setTimeout> | undefined

  function setLabel(text: string) {
    button.textContent = text
    clearTimeout(resetTimer)
    if (!button.disabled) {
      resetTimer = setTimeout(() => (button.textContent = IDLE_LABEL), 8000)
    }
  }

  function onFocusIn(event: FocusEvent) {
    if (!(event.target instanceof HTMLElement)) return
    const editor = event.target.closest<HTMLElement>(COMMENT_EDITOR_SELECTOR)
    if (editor && !editor.closest(COMMENT_OR_REPLY_SELECTOR)) {
      lastFocused = editor
    }
  }

  button.addEventListener("click", async () => {
    const editor = pickEditor(lastFocused)
    if (!editor) {
      setLabel("Comment box not found")
      return
    }
    button.disabled = true
    try {
      await run(editor, button, setLabel)
    } finally {
      button.disabled = false
      setLabel(button.textContent ?? IDLE_LABEL)
    }
  })

  // Only show the button while a main comment box exists on the page.
  const syncVisibility = () => {
    host.style.display = findMainEditors().length > 0 ? "" : "none"
  }
  syncVisibility()
  const observer = new MutationObserver(syncVisibility)
  observer.observe(document.body, { childList: true, subtree: true })

  document.addEventListener("focusin", onFocusIn)
  document.body.append(host)

  return () => {
    observer.disconnect()
    document.removeEventListener("focusin", onFocusIn)
    clearTimeout(resetTimer)
    host.remove()
  }
}
