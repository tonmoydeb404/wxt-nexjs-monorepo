import {
  addMentioned,
  getMentioned,
  indicatorPositionItem,
  resetPost,
  watchSettings,
  type IndicatorPosition,
} from "@/lib"

import {
  articleId,
  expandComments,
  filterCommenters,
  findReplyContext,
  findThread,
  isReplyArticle,
  readCommenters,
  readPostKey,
  readReplyRepliers,
  readRepliers,
  threadId,
  type Commenter,
} from "./collect-commenters"
import { insertMentions } from "./insert-mentions"
import {
  COMMENT_EDITOR_SELECTOR,
  COMMENT_OR_REPLY_SELECTOR,
  COMMENT_SELECTOR,
  MENTION_BUTTON_ATTR,
} from "./selectors"

const FALLBACK_ATTR = "data-fb-mention-fallback"

const TOOLBAR_SELECTOR =
  '#focused-state-actions-list ul, ul[data-id$="state-actions-list"]'

function findEditors() {
  return Array.from(
    document.querySelectorAll<HTMLElement>(COMMENT_EDITOR_SELECTOR)
  )
}

// The post-level box ("Comment as …") rather than a reply box under a comment.
function isMainEditor(editor: HTMLElement) {
  return (
    !isReplyEditor(editor) &&
    /^comment/i.test(editor.getAttribute("aria-label") ?? "")
  )
}

function isReplyEditor(editor: HTMLElement) {
  return (
    editor.closest(COMMENT_OR_REPLY_SELECTOR) != null ||
    /reply/i.test(editor.getAttribute("aria-label") ?? "")
  )
}

// A reply box lives inside its post, so the closest ancestor that also holds
// a main box tells us which post's comments to read.
function findMainEditorFor(editor: HTMLElement) {
  if (isMainEditor(editor)) return editor
  let node = editor.parentElement
  while (node) {
    const main = Array.from(
      node.querySelectorAll<HTMLElement>(COMMENT_EDITOR_SELECTOR)
    ).find(isMainEditor)
    if (main) return main
    node = node.parentElement
  }
  return editor
}

// Climb from the post's main comment box to the largest container that still
// holds only that one main box. Stopping at the first container with a comment
// misses comments when Facebook re-renders the list (sort change, expanders).
function findCommentsScope(editor: HTMLElement) {
  let node: HTMLElement = findMainEditorFor(editor)
  while (node.parentElement) {
    const parent = node.parentElement
    const mains = Array.from(
      parent.querySelectorAll<HTMLElement>(COMMENT_EDITOR_SELECTOR)
    ).filter(isMainEditor)
    if (mains.length > 1) break
    node = parent
  }
  return node
}

// "Comment as Tonmoy Deb" -> "Tonmoy Deb"
function readSelfName(editor: HTMLElement) {
  const label = editor.getAttribute("aria-label") ?? ""
  return /\bas (.+)$/i.exec(label)?.[1]?.trim() ?? null
}

type RunResult = { remaining: number; batch: number }
// post: everyone on the post. thread: everyone who replied under the top-level
// comment. reply: only those who replied to the specific reply being answered.
type Source = "post" | "thread" | "reply"

type Group = { key: string; scope: Element; read: () => Commenter[] }

// The people behind a thread/reply source, or null when the box has none.
function resolveGroup(editor: HTMLElement, source: Source): Group | null {
  const postKey = readPostKey(findCommentsScope(editor))
  if (source === "thread") {
    const thread = findThread(editor)
    if (!thread) return null
    return {
      key: `${postKey}#thread:${threadId(thread)}`,
      scope: thread.scope,
      read: () => readRepliers(thread),
    }
  }
  if (source === "reply") {
    const context = findReplyContext(editor)
    // Answering a top-level comment has no "reply of a reply" to look at.
    if (!context || !isReplyArticle(context.target)) return null
    return {
      key: `${postKey}#reply:${articleId(context.target)}`,
      scope: context.scope,
      read: () => readReplyRepliers(context),
    }
  }
  return null
}

function sourceKey(editor: HTMLElement, source: Source) {
  return source === "post"
    ? readPostKey(findCommentsScope(editor))
    : (resolveGroup(editor, source)?.key ?? null)
}

const SOURCE_LABELS: Record<Source, string> = {
  post: "Commenters of the post",
  thread: "Repliers of the comment",
  reply: "Repliers of this reply",
}

async function run(
  editor: HTMLElement,
  source: Source,
  caret: Range | null,
  setLabel: (text: string) => void,
  signal: AbortSignal
): Promise<RunResult | null> {
  // Live settings: popup edits apply mid-run (delay, limits, exclude list).
  const live = await watchSettings()
  try {
    const mode = live.get().mode
    const scope = findCommentsScope(editor)
    const group = resolveGroup(editor, source)
    if (source !== "post" && !group) {
      setLabel("Couldn't find the comment this reply box belongs to")
      return null
    }
    // Each group is remembered apart from the post-wide batches.
    const postKey = group ? group.key : readPostKey(scope)
    const mentioned = await getMentioned(postKey)
    const selfName = readSelfName(editor)
    // Where to click "View more / View N replies".
    const expandScope = group ? group.scope : scope

    // Everyone not yet mentioned, excluded, or already in the box.
    const available = () =>
      filterCommenters(
        group
          ? group.read()
          : readCommenters(scope, {
              includeReplies: live.get().includeReplies,
            }),
        {
          excludeNames: live.get().excludeNames,
          mentioned,
          editorText: editor.textContent ?? "",
          selfName,
        }
      )

    if (mode === "auto") {
      setLabel("Loading comments…")
      await expandComments(expandScope, {
        getDelayMs: () => live.get().delayMs,
        getIncludeReplies: () => source !== "post" || live.get().includeReplies,
        isEnough: () => available().length >= live.get().maxCollect,
        onRound: () =>
          setLabel(`Loading comments… ${available().length} found`),
        signal,
      })
      if (signal.aborted) {
        setLabel("Stopped while loading comments")
        return null
      }
    }

    const everyone = available()
    const batch = everyone.slice(0, live.get().batchSize)
    const articles = Array.from(scope.querySelectorAll(COMMENT_SELECTOR))
    console.log(
      `[fb-mention] source=${source}: ${everyone.length} new, ${mentioned.size} already mentioned, batch of ${batch.length}`,
      batch
    )
    console.log(
      `[fb-mention] ${articles.length} comment articles in scope, ${
        articles.filter((a) =>
          a.getAttribute("aria-label")?.startsWith("Reply by")
        ).length
      } labelled "Reply by"`,
      articles.map((a) => a.getAttribute("aria-label"))
    )

    if (batch.length === 0) {
      setLabel(
        mentioned.size > 0
          ? "Everyone is already mentioned"
          : source !== "post"
            ? "No repliers found (see console)"
            : "No commenters found (see console)"
      )
      return null
    }

    if (live.get().dryRun) {
      setLabel(`Dry run: ${batch.length} of ${everyone.length} found`)
      return { remaining: everyone.length, batch: 0 }
    }

    const result = await insertMentions(editor, batch, {
      getDelayMs: () => live.get().delayMs,
      caret,
      signal,
      onInserted: async (commenter, done) => {
        await addMentioned(postKey, commenter.username)
        setLabel(`Mentioning ${done}/${batch.length}…`)
      },
    })

    const remaining = everyone.length - result.inserted
    setLabel(
      `${result.stopped ? "Stopped" : "Done"}: ${result.inserted} mentioned` +
        (result.skipped.length > 0
          ? `, ${result.skipped.length} skipped`
          : "") +
        `, ${remaining} left.` +
        (result.inserted > 0 ? " Press Enter to post." : "")
    )
    return { remaining, batch: result.inserted }
  } finally {
    live.stop()
  }
}

const ICON_STYLE = `
  :host { all: initial }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--secondary-icon, #65686c);
    cursor: pointer;
  }
  button:hover { background: rgba(128, 128, 128, 0.2) }
  button:disabled { opacity: 0.5; cursor: progress }
  svg { width: 20px; height: 20px }
`

const TOAST_STYLE = `
  :host { all: initial }
  .panel {
    position: fixed;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 340px;
    padding: 8px 8px 8px 14px;
    border-radius: 12px;
    background: #0866ff;
    color: #fff;
    font: 600 13px system-ui, sans-serif;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  .panel.dragging { cursor: grabbing }
  .panel[hidden] { display: none }
  .stop {
    flex: none;
    padding: 4px 10px;
    border: 0;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.95);
    color: #0866ff;
    font: 700 12px system-ui, sans-serif;
    cursor: pointer;
  }
  .stop[hidden] { display: none }
`

const TIP_STYLE = `
  :host { all: initial }
  div {
    position: fixed;
    z-index: 2147483647;
    padding: 6px 10px;
    border-radius: 8px;
    background: rgba(40, 40, 40, 0.92);
    color: #fff;
    font: 500 13px system-ui, sans-serif;
    white-space: nowrap;
    pointer-events: none;
    transform: translate(-50%, -100%);
  }
  div[hidden] { display: none }
`

const MENU_STYLE = `
  :host { all: initial }
  .menu {
    position: fixed;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    min-width: 200px;
    padding: 6px;
    border-radius: 12px;
    background: #242526;
    color: #e4e6eb;
    font: 500 14px system-ui, sans-serif;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
    transform: translate(-50%, -100%);
  }
  .menu[hidden] { display: none }
  .title {
    padding: 6px 10px 4px;
    color: #b0b3b8;
    font-size: 12px;
  }
  .menu button {
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.1) }
  .menu button:disabled { opacity: 0.4; cursor: default }
`

// Tabler "at" and "refresh" icons.
const MENTION_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0v-1.5a9 9 0 1 0 -5.5 8.28"/></svg>'
const RESET_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>'

// The icon row under a comment box. It is found by walking up from the box,
// but never into a container that holds another comment box.
function findToolbar(editor: HTMLElement) {
  let node: HTMLElement | null = editor
  for (let depth = 0; node && depth < 10; depth++) {
    const toolbar = node.querySelector<HTMLElement>(TOOLBAR_SELECTOR)
    if (toolbar) return toolbar
    node = node.parentElement
    if (node && node.querySelectorAll(COMMENT_EDITOR_SELECTOR).length > 1) break
  }
  return null
}

function createIconItem(options: {
  icon: string
  title: string
  kind: "mention" | "reset"
  onClick: (button: HTMLButtonElement) => void
  onTipShow: (button: HTMLButtonElement) => void
  onTipHide: () => void
}) {
  const item = document.createElement("li")
  item.setAttribute(MENTION_BUTTON_ATTR, options.kind)
  const host = document.createElement("span")
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = ICON_STYLE
  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute("aria-label", options.title)
  button.innerHTML = options.icon
  button.addEventListener("click", () => options.onClick(button))
  button.addEventListener("mouseenter", () => options.onTipShow(button))
  button.addEventListener("focus", () => options.onTipShow(button))
  button.addEventListener("mouseleave", options.onTipHide)
  button.addEventListener("blur", options.onTipHide)
  shadow.append(style, button)
  item.append(host)
  return { item, button }
}

const TOAST_HIDE_MS = 12000

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function mountMentionButtons() {
  const toastHost = document.createElement("div")
  const toastShadow = toastHost.attachShadow({ mode: "open" })
  const toastStyle = document.createElement("style")
  toastStyle.textContent = TOAST_STYLE
  const panel = document.createElement("div")
  panel.className = "panel"
  panel.hidden = true
  const label = document.createElement("span")
  const stop = document.createElement("button")
  stop.className = "stop"
  stop.type = "button"
  stop.textContent = "Stop"
  stop.hidden = true
  panel.append(label, stop)
  toastShadow.append(toastStyle, panel)
  document.body.append(toastHost)

  // One tooltip on <body> so the toolbar's overflow can't clip it.
  const tipHost = document.createElement("div")
  const tipShadow = tipHost.attachShadow({ mode: "open" })
  const tipStyle = document.createElement("style")
  tipStyle.textContent = TIP_STYLE
  const tip = document.createElement("div")
  tip.hidden = true
  tipShadow.append(tipStyle, tip)
  document.body.append(tipHost)

  function showTip(button: HTMLButtonElement) {
    const rect = button.getBoundingClientRect()
    tip.textContent = button.getAttribute("aria-label")
    tip.style.left = `${rect.left + rect.width / 2}px`
    tip.style.top = `${rect.top - 6}px`
    tip.hidden = false
  }
  const hideTip = () => (tip.hidden = true)

  // Source picker for reply boxes: whole post, or just this comment's repliers.
  const menuHost = document.createElement("div")
  const menuShadow = menuHost.attachShadow({ mode: "open" })
  const menuStyle = document.createElement("style")
  menuStyle.textContent = MENU_STYLE
  const menu = document.createElement("div")
  menu.className = "menu"
  menu.hidden = true
  menuShadow.append(menuStyle, menu)
  document.body.append(menuHost)

  let menuKind: string | null = null

  const hideMenu = () => {
    menu.hidden = true
    menuKind = null
  }

  function showMenu(
    anchor: HTMLButtonElement,
    kind: string,
    heading: string,
    editor: HTMLElement,
    onPick: (source: Source) => void
  ) {
    menu.replaceChildren()
    const title = document.createElement("div")
    title.className = "title"
    title.textContent = heading
    menu.append(title)
    const sources: Source[] = ["post", "thread", "reply"]
    for (const source of sources) {
      const item = document.createElement("button")
      item.type = "button"
      item.textContent = SOURCE_LABELS[source]
      item.disabled = source !== "post" && !resolveGroup(editor, source)
      item.addEventListener("click", () => {
        hideMenu()
        onPick(source)
      })
      menu.append(item)
    }
    menuKind = kind
    const rect = anchor.getBoundingClientRect()
    menu.style.left = `${clamp(rect.left + rect.width / 2, 110, window.innerWidth - 110)}px`
    menu.style.top = `${rect.top - 8}px`
    menu.hidden = false
  }

  // Click anywhere else, or Escape, closes the menu.
  const onDocPointerDown = (event: PointerEvent) => {
    if (
      !event.composedPath().includes(menuHost) &&
      !event
        .composedPath()
        .some(
          (n) => n instanceof HTMLElement && n.hasAttribute(MENTION_BUTTON_ATTR)
        )
    ) {
      hideMenu()
    }
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") hideMenu()
  }
  document.addEventListener("pointerdown", onDocPointerDown, true)
  document.addEventListener("keydown", onKeyDown, true)

  const buttons = new Set<HTMLButtonElement>()
  const carets = new WeakMap<HTMLElement, Range>()
  let busy = false
  let hovered = false
  let controller: AbortController | null = null
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  // --- indicator position: draggable, remembered across pages and sessions
  let position: IndicatorPosition | null = null
  void indicatorPositionItem.getValue().then((saved) => {
    position = saved
  })

  function applyPosition() {
    const width = panel.offsetWidth
    const height = panel.offsetHeight
    const wanted = position ?? {
      x: window.innerWidth - width - 16,
      y: window.innerHeight - height - 16,
    }
    const x = clamp(wanted.x, 0, window.innerWidth - width)
    const y = clamp(wanted.y, 0, window.innerHeight - height)
    if (position) position = { x, y }
    panel.style.left = `${x}px`
    panel.style.top = `${y}px`
  }

  panel.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest("button"))
      return
    const rect = panel.getBoundingClientRect()
    const offsetX = event.clientX - rect.left
    const offsetY = event.clientY - rect.top
    panel.setPointerCapture(event.pointerId)
    panel.classList.add("dragging")

    const onMove = (move: PointerEvent) => {
      position = { x: move.clientX - offsetX, y: move.clientY - offsetY }
      applyPosition()
    }
    const onUp = () => {
      panel.removeEventListener("pointermove", onMove)
      panel.removeEventListener("pointerup", onUp)
      panel.classList.remove("dragging")
      void indicatorPositionItem.setValue(position)
    }
    panel.addEventListener("pointermove", onMove)
    panel.addEventListener("pointerup", onUp)
  })
  const onResize = () => {
    if (!panel.hidden) applyPosition()
  }
  window.addEventListener("resize", onResize)

  // --- status text; hides itself when idle and not being hovered
  function scheduleHide() {
    clearTimeout(toastTimer)
    if (busy || hovered) return
    toastTimer = setTimeout(() => (panel.hidden = true), TOAST_HIDE_MS)
  }
  panel.addEventListener("pointerenter", () => {
    hovered = true
    clearTimeout(toastTimer)
  })
  panel.addEventListener("pointerleave", () => {
    hovered = false
    scheduleHide()
  })

  function setLabel(text: string) {
    label.textContent = text
    panel.hidden = false
    applyPosition()
    scheduleHide()
  }

  stop.addEventListener("click", () => {
    controller?.abort()
    setLabel("Stopping…")
  })

  function setBusy(value: boolean) {
    busy = value
    stop.hidden = !value
    for (const button of buttons) {
      if (button.isConnected) button.disabled = value
      else buttons.delete(button)
    }
    if (panel.hidden === false) applyPosition()
  }

  function setMentionTitle(text: string) {
    for (const button of buttons) {
      if (button.dataset.kind === "mention") {
        button.setAttribute("aria-label", text)
      }
    }
  }

  // Remember where the caret was in each box; clicking the icon moves focus.
  function onSelectionChange() {
    const selection = document.getSelection()
    const node = selection?.anchorNode
    if (!selection || !node || selection.rangeCount === 0) return
    const element = node instanceof Element ? node : node.parentElement
    const editor = element?.closest<HTMLElement>(COMMENT_EDITOR_SELECTOR)
    if (editor) carets.set(editor, selection.getRangeAt(0).cloneRange())
  }
  document.addEventListener("selectionchange", onSelectionChange)

  async function forget(editor: HTMLElement, source: Source) {
    const key = sourceKey(editor, source)
    if (!key) {
      setLabel("Couldn't find the comment this reply box belongs to")
      return
    }
    await resetPost(key)
    setMentionTitle("Mention commenters")
    setLabel(`Reset: ${SOURCE_LABELS[source].toLowerCase()} start fresh`)
  }

  async function start(editor: HTMLElement, source: Source) {
    if (busy) return
    controller = new AbortController()
    setBusy(true)
    try {
      const result = await run(
        editor,
        source,
        carets.get(editor) ?? null,
        setLabel,
        controller.signal
      )
      if (result) {
        setMentionTitle(
          result.remaining > 0
            ? `Mention next (${result.remaining} left)`
            : "Mention commenters"
        )
      }
    } finally {
      controller = null
      setBusy(false)
      scheduleHide()
    }
  }

  // Facebook only renders a reply box's icon row on focus. Until it shows up,
  // put our own row right under the box so the buttons are always available.
  function inject(editor: HTMLElement) {
    const toolbar = findToolbar(editor)
    const form = editor.closest("form")
    const fallback = form?.parentElement?.querySelector(
      `:scope > [${FALLBACK_ATTR}]`
    )

    if (toolbar) {
      fallback?.remove()
      if (!toolbar.querySelector(`[${MENTION_BUTTON_ATTR}]`)) {
        addIcons(toolbar, editor)
      }
      return
    }
    if (!form || fallback) return

    const row = document.createElement("ul")
    row.setAttribute(FALLBACK_ATTR, "")
    Object.assign(row.style, {
      display: "flex",
      gap: "4px",
      margin: "0",
      padding: "2px 8px",
      listStyle: "none",
    })
    form.after(row)
    addIcons(row, editor)
  }

  function addIcons(toolbar: HTMLElement, editor: HTMLElement) {
    const mention = createIconItem({
      icon: MENTION_ICON,
      title: "Mention commenters",
      kind: "mention",
      onTipShow: showTip,
      onTipHide: hideTip,
      onClick: (button) => {
        if (busy) return
        // Reply boxes ask which people to mention; the main box doesn't.
        if (!isReplyEditor(editor)) {
          void start(editor, "post")
        } else if (menuKind === "mention") {
          hideMenu()
        } else {
          showMenu(
            button,
            "mention",
            "Mention…",
            editor,
            (source) => void start(editor, source)
          )
        }
      },
    })
    const reset = createIconItem({
      icon: RESET_ICON,
      title: "Forget who was mentioned on this post",
      kind: "reset",
      onTipShow: showTip,
      onTipHide: hideTip,
      onClick: (button) => {
        if (busy) return
        if (!isReplyEditor(editor)) {
          void forget(editor, "post")
        } else if (menuKind === "reset") {
          hideMenu()
        } else {
          showMenu(
            button,
            "reset",
            "Forget who was mentioned…",
            editor,
            (source) => void forget(editor, source)
          )
        }
      },
    })
    mention.button.dataset.kind = "mention"
    reset.button.dataset.kind = "reset"
    buttons.add(mention.button)
    buttons.add(reset.button)
    toolbar.append(mention.item, reset.item)
  }

  // Facebook re-renders the toolbar often, so re-inject whenever it changes.
  const scan = () => findEditors().forEach(inject)
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    observer.disconnect()
    controller?.abort()
    clearTimeout(toastTimer)
    window.removeEventListener("resize", onResize)
    document.removeEventListener("selectionchange", onSelectionChange)
    document.removeEventListener("pointerdown", onDocPointerDown, true)
    document.removeEventListener("keydown", onKeyDown, true)
    toastHost.remove()
    tipHost.remove()
    menuHost.remove()
    document
      .querySelectorAll(`[${MENTION_BUTTON_ATTR}], [${FALLBACK_ATTR}]`)
      .forEach((el) => el.remove())
  }
}
