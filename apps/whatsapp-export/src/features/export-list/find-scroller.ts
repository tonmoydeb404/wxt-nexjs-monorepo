import { findRows } from "./collect-rows"
import { PANE_SELECTOR } from "./selectors"

function isScrollable(el: HTMLElement) {
  const overflowY = getComputedStyle(el).overflowY
  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    el.scrollHeight > el.clientHeight
  )
}

/** Nearest scrollable ancestor of the first list row. */
export function findScroller(): HTMLElement | null {
  const first = findRows()[0]
  for (let el = first?.parentElement; el; el = el.parentElement) {
    if (isScrollable(el)) return el
  }
  return document.querySelector<HTMLElement>(PANE_SELECTOR)
}
