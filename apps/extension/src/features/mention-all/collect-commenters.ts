import { delay } from "@/lib"

import { COMMENT_SELECTOR, EXPAND_BUTTON_PATTERN } from "./selectors"

export type Commenter = {
  name: string
  // Profile slug, e.g. "nagibmahfuzneloy" from facebook.com/nagibmahfuzneloy.
  username: string
  profileUrl: string
}

const MAX_EXPAND_ROUNDS = 30

function findExpandButtons(post: Element) {
  return Array.from(
    post.querySelectorAll<HTMLElement>('[role="button"]')
  ).filter((el) => EXPAND_BUTTON_PATTERN.test(el.textContent?.trim() ?? ""))
}

export async function expandComments(post: Element, delayMs: number) {
  for (let round = 0; round < MAX_EXPAND_ROUNDS; round++) {
    const buttons = findExpandButtons(post)
    if (buttons.length === 0) return
    for (const button of buttons) button.click()
    await delay(delayMs)
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

export function readCommenters(post: Element): Commenter[] {
  const seen = new Map<string, Commenter>()

  for (const comment of post.querySelectorAll(COMMENT_SELECTOR)) {
    // The first link is the empty avatar and the timestamp link has an
    // aria-label, so the author is the first link with text and no label.
    const link = Array.from(
      comment.querySelectorAll<HTMLAnchorElement>("a[role='link']")
    ).find((a) => !a.hasAttribute("aria-label") && a.textContent?.trim())
    const name = link?.textContent?.trim()
    if (!link || !name) continue
    // profile.php?id=… links have no username, so they can't be mentioned.
    const username = profileUsername(link.href)
    if (!username) continue
    const key = profileKey(link.href)
    if (!seen.has(key))
      seen.set(key, {
        name,
        username,
        profileUrl: link.href,
      })
  }

  return Array.from(seen.values())
}

export function filterCommenters(
  commenters: Commenter[],
  excludeNames: string[]
) {
  const excluded = new Set(excludeNames.map((n) => n.trim().toLowerCase()))
  return commenters.filter((c) => !excluded.has(c.name.toLowerCase()))
}
