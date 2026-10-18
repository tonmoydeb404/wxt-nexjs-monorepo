import { delay } from "@/lib"

import {
  COMMENT_SELECTOR,
  MORE_COMMENTS_PATTERN,
  REPLIES_PATTERN,
  REPLY_LABEL_PREFIX,
} from "./selectors"

export type Commenter = {
  name: string
  // Profile slug, e.g. "nagibmahfuzneloy" from facebook.com/nagibmahfuzneloy.
  username: string
  profileUrl: string
  isReply: boolean
}

const MAX_EXPAND_ROUNDS = 30
const MAX_SETTLE_MS = 8000

// Replies load asynchronously after the click. Wait until the number of
// comments stops changing, so we never read the list mid-load.
async function settle(
  scope: Element,
  getDelayMs: () => number,
  signal?: AbortSignal
) {
  const deadline = Date.now() + MAX_SETTLE_MS
  let previous = -1
  while (Date.now() < deadline && !signal?.aborted) {
    await delay(Math.max(getDelayMs(), 600))
    const count = scope.querySelectorAll(COMMENT_SELECTOR).length
    if (count === previous) return
    previous = count
  }
}

function findExpandButtons(scope: Element, includeReplies: boolean) {
  return Array.from(
    scope.querySelectorAll<HTMLElement>('[role="button"]')
  ).filter((el) => {
    const text = el.textContent?.trim() ?? ""
    return (
      MORE_COMMENTS_PATTERN.test(text) ||
      (includeReplies && REPLIES_PATTERN.test(text))
    )
  })
}

// Clicks "View more comments" (and reply expanders) until nothing is left to
// open or isEnough() says we already have as many people as we need.
export async function expandComments(
  scope: Element,
  options: {
    // Getters, so popup changes apply between rounds.
    getDelayMs: () => number
    getIncludeReplies: () => boolean
    isEnough: () => boolean
    onRound?: () => void
    signal?: AbortSignal
  }
) {
  for (let round = 0; round < MAX_EXPAND_ROUNDS; round++) {
    if (options.signal?.aborted || options.isEnough()) return
    const buttons = findExpandButtons(scope, options.getIncludeReplies())
    if (buttons.length === 0) return
    for (const button of buttons) button.click()
    options.onRound?.()
    await settle(scope, options.getDelayMs, options.signal)
  }
}

// Strip tracking params so the same person always maps to one key.
function profileKey(href: string) {
  const url = new URL(href, location.origin)
  const id = url.searchParams.get("id")
  return id ? `id:${id}` : url.pathname.replace(/\/$/, "")
}

function profileUsername(href: string) {
  const url = new URL(href, location.origin)
  const [slug, ...rest] = url.pathname.split("/").filter(Boolean)
  if (!slug || rest.length > 0 || slug === "profile.php") return null
  return slug
}

// A reply is labelled "Reply by …" or sits inside another comment's article.
export function isReplyArticle(article: Element) {
  return (
    article.getAttribute("aria-label")?.startsWith(REPLY_LABEL_PREFIX) ===
      true || article.parentElement?.closest(COMMENT_SELECTOR) != null
  )
}

// The first link is the empty avatar and the timestamp link has an
// aria-label, so the author is the first link with text and no label.
function findAuthorLink(article: Element) {
  return Array.from(
    article.querySelectorAll<HTMLAnchorElement>("a[role='link']")
  ).find((a) => !a.hasAttribute("aria-label") && a.textContent?.trim())
}

function authorName(article: Element) {
  return findAuthorLink(article)?.textContent?.replace(/\s+/g, " ").trim()
}

function commentersFrom(
  articles: Iterable<Element>,
  options: { includeReplies: boolean }
): Commenter[] {
  const seen = new Map<string, Commenter>()

  for (const comment of articles) {
    const isReply = isReplyArticle(comment)
    if (isReply && !options.includeReplies) continue

    const link = findAuthorLink(comment)
    const name = link?.textContent?.replace(/\s+/g, " ").trim()
    if (!link || !name) continue
    // profile.php?id=… links have no username, so they can't be mentioned.
    const username = profileUsername(link.href)
    if (!username) continue
    const key = profileKey(link.href)
    // One entry per person, even if they commented and replied many times.
    if (!seen.has(key)) {
      seen.set(key, { name, username, profileUrl: link.href, isReply })
    }
  }

  return Array.from(seen.values())
}

export function readCommenters(
  scope: Element,
  options: { includeReplies: boolean }
): Commenter[] {
  return commentersFrom(scope.querySelectorAll(COMMENT_SELECTOR), options)
}

// Facebook puts a top-level comment, its replies and its reply box in one
// wrapper that holds exactly one top-level comment. So the thread around a
// reply box is its first ancestor that contains a top-level comment.
export function findThread(editor: HTMLElement) {
  let node = editor.parentElement
  while (node) {
    const parent = Array.from(node.querySelectorAll(COMMENT_SELECTOR)).find(
      (article) => !isReplyArticle(article)
    )
    if (parent) return { scope: node, parent }
    node = node.parentElement
  }
  return null
}

export type Thread = NonNullable<ReturnType<typeof findThread>>

// Stable id for a comment or reply: its own comment_id.
export function articleId(article: Element) {
  for (const link of article.querySelectorAll<HTMLAnchorElement>(
    'a[href*="comment_id="]'
  )) {
    const id = new URL(link.href).searchParams.get("comment_id")
    if (id) return id
  }
  return "unknown"
}

export function threadId(thread: Thread) {
  return articleId(thread.parent)
}

// People who replied anywhere under the thread's top-level comment, including
// replies to replies.
export function readRepliers(thread: Thread) {
  const replies = Array.from(
    thread.scope.querySelectorAll(COMMENT_SELECTOR)
  ).filter(isReplyArticle)
  return commentersFrom(replies, { includeReplies: true })
}

// A reply box is labelled "Reply to <name>". The reply it answers is the
// nearest article by that person inside the first container that has one: for
// a reply to a reply that container holds just that reply and its sub-replies.
export function findReplyContext(editor: HTMLElement) {
  const label = editor.getAttribute("aria-label") ?? ""
  const name = /^reply to (.+)$/i.exec(label)?.[1]?.replace(/\s+/g, " ").trim()
  if (!name) return null

  let node = editor.parentElement
  while (node) {
    const authored = Array.from(node.querySelectorAll(COMMENT_SELECTOR)).filter(
      (article) => authorName(article) === name
    )
    if (authored.length > 0) {
      const before = authored.filter(
        (a) =>
          a.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING
      )
      return { scope: node, target: before[before.length - 1] ?? authored[0] }
    }
    node = node.parentElement
  }
  return null
}

export type ReplyContext = NonNullable<ReturnType<typeof findReplyContext>>

// People who replied to one specific reply (not the whole thread).
export function readReplyRepliers(context: ReplyContext) {
  const replies = Array.from(
    context.scope.querySelectorAll(COMMENT_SELECTOR)
  ).filter((a) => isReplyArticle(a) && a !== context.target)
  return commentersFrom(replies, { includeReplies: true })
}

export function filterCommenters(
  commenters: Commenter[],
  options: {
    excludeNames: string[]
    // Usernames already mentioned on this post in earlier batches.
    mentioned: Set<string>
    // Text already in the comment box (covers the prefilled reply target).
    editorText: string
    selfName: string | null
  }
) {
  const excluded = new Set(
    options.excludeNames.map((n) => n.trim().toLowerCase())
  )
  const editorText = options.editorText.toLowerCase()
  const self = options.selfName?.toLowerCase()

  return commenters.filter((c) => {
    const name = c.name.toLowerCase()
    return (
      !excluded.has(name) &&
      name !== self &&
      !options.mentioned.has(c.username) &&
      !editorText.includes(name)
    )
  })
}

// The post id sits in comment links as base64 ("comment:<postId>_<commentId>"),
// which identifies the post even when the URL doesn't (e.g. a feed dialog).
export function readPostKey(scope: Element) {
  for (const link of scope.querySelectorAll<HTMLAnchorElement>(
    'a[href*="comment_id="]'
  )) {
    const encoded = new URL(link.href).searchParams.get("comment_id")
    if (!encoded) continue
    try {
      const match = /^comment:(\d+)_/.exec(atob(encoded))
      if (match) return `post:${match[1]}`
    } catch {
      // Not base64 (plain numeric comment id); try the next link.
    }
  }
  return `url:${location.pathname}${location.search}`
}
