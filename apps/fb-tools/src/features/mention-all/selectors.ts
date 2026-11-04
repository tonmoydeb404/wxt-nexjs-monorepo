// All Facebook DOM selectors live here. Facebook's markup is obfuscated and
// changes often, so keep them in one place and prefer role/aria attributes.

// Verified: <div role="article" aria-label="Comment by <name> 28 minutes ago">
export const COMMENT_SELECTOR =
  '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
// Verified against a real page: <div aria-label="Comment as <name>"
// contenteditable="true" role="textbox" data-lexical-editor="true">
// Reply boxes are assumed to be the same kind of editor labelled "Reply …".
const EDITOR_BASE =
  '[contenteditable="true"][role="textbox"][data-lexical-editor="true"]'
export const COMMENT_EDITOR_SELECTOR = `${EDITOR_BASE}[aria-label*="comment" i], ${EDITOR_BASE}[aria-label*="reply" i]`
// Comments and replies are themselves role=article, so the main comment box is
// the editor that is NOT inside one of these.
export const COMMENT_OR_REPLY_SELECTOR = COMMENT_SELECTOR
export const TYPEAHEAD_OPTION_SELECTOR = '[role="listbox"] [role="option"]'
export const MORE_COMMENTS_PATTERN = /^view (more|previous) comments?/i
export const REPLIES_PATTERN =
  /^(view \d+ (more )?repl(y|ies)|\d+ repl(y|ies)|view (all )?repl(y|ies))/i
export const REPLY_LABEL_PREFIX = "Reply by"
export const MENTION_BUTTON_ATTR = "data-fb-mention-all"
