// WhatsApp Web uses obfuscated class names, so rely on ARIA roles and
// stable attributes only. Several fallbacks keep this working across UI updates.
export const ROW_SELECTORS = [
  '#pane-side [role="listitem"]',
  '#pane-side [role="row"]',
  '[role="dialog"] [role="listitem"]',
  '[role="dialog"] [role="row"]',
  '[role="listitem"]',
]

export const PANE_SELECTOR = "#pane-side"
