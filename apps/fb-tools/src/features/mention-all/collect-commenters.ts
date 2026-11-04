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
  // null when the profile link is id-based (profile.php?id=… or
  // /people/<name>/<id>/): those people are mentioned by display name instead.
  username: string | null
  // Stable identity (id:<uid> or the profile path) used for dedupe and
  // "already mentioned" bookkeeping, because username can be missing.
  key: string
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

// Facebook routes a single path segment could collide with; a vanity
// username never shares one of these.
const NON_SLUG_PATHS = new Set([
  "friends",
  "gaming",
  "groups",
  "hashtag",
  "help",
  "live",
  "login",
  "marketplace",
  "media",
  "pages",
  "pg",
  "photo",
  "plugins",
  "policies",
  "privacy",
  "public",
  "reel",
  "search",
  "share",
  "sold",
  "watch",
])

type Profile = { key: string; username: string | null }

// What a profile link tells us: a dedupe key and, when it exists, the vanity
// slug usable as "@slug". Group posts link authors through id-based URLs
// (profile.php?id=…, /people/<name>/<id>/) that carry no slug, so those stay
// valid profiles with username: null. Returns null for everything else
// (comment permalinks, group pages, photos…).
function parseProfileHref(href: string): Profile | null {
  let url: URL
  try {
    url = new URL(href, location.origin)
  } catch {
    return null
  }
  const id = url.searchParams.get("id")
  if (url.pathname === "/profile.php" && id) {
    return { key: `id:${id}`, username: null }
  }
  const segments = url.pathname.split("/").filter(Boolean)
  // Modern form for profiles without a slug: /people/<name>/<id>/.
  if (
    segments[0] === "people" &&
    segments.length === 3 &&
    /^\d+$/.test(segments[2])
  ) {
    return { key: `id:${segments[2]}`, username: null }
  }
  if (segments.length !== 1) return null
  const slug = segments[0]
  const lower = slug.toLowerCase()
  // A system script, hashtag target or numeric object id still identifies the
  // person for dedupe, but there is no "@handle" to type for them.
  if (lower.endsWith(".php") || lower.startsWith("#") || /^\d+$/.test(lower)) {
    return { key: url.pathname.replace(/\/$/, ""), username: null }
  }
  if (NON_SLUG_PATHS.has(lower)) return null
  return { key: url.pathname.replace(/\/$/, ""), username: slug }
}

// A reply is labelled "Reply by …" or sits inside another comment's article.
export function isReplyArticle(article: Element) {
  return (
    article.getAttribute("aria-label")?.startsWith(REPLY_LABEL_PREFIX) ===
      true || article.parentElement?.closest(COMMENT_SELECTOR) != null
  )
}

// The author is a profile-shaped link, not any text link: comment permalinks
// and timestamps don't qualify. Card order is avatar link (often empty and
// just labelled with the name) then the name link; profile links inside the
// comment text come later, so the first profile link with text wins and a
// labelled avatar link is the fallback.
type Author = { link: HTMLAnchorElement; profile: Profile }

function findAuthor(article: Element): Author | null {
  let labelled: Author | null = null
  for (const link of article.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const profile = parseProfileHref(link.href)
    if (!profile) continue
    if (link.textContent?.replace(/\s+/g, " ").trim()) return { link, profile }
    if (!labelled && link.getAttribute("aria-label"))
      labelled = { link, profile }
  }
  return labelled
}

// Visible name text first, then the avatar link's aria-label.
function authorName(author: Author) {
  return (
    author.link.textContent?.replace(/\s+/g, " ").trim() ||
    author.link.getAttribute("aria-label")?.replace(/\s+/g, " ").trim() ||
    null
  )
}

function commentersFrom(
  articles: Iterable<Element>,
  options: { includeReplies: boolean }
): Commenter[] {
  const seen = new Map<string, Commenter>()

  for (const comment of articles) {
    const isReply = isReplyArticle(comment)
    if (isReply && !options.includeReplies) continue

    const author = findAuthor(comment)
    if (!author) continue
    const name = authorName(author)
    if (!name) continue
    // One entry per person, even if they commented and replied many times.
    if (!seen.has(author.profile.key)) {
      seen.set(author.profile.key, {
        name,
        username: author.profile.username,
        key: author.profile.key,
        profileUrl: author.link.href,
        isReply,
      })
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
      (article) => {
        const author = findAuthor(article)
        return author != null && authorName(author) === name
      }
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
      !options.mentioned.has(c.key) &&
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
