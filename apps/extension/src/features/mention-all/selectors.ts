// All Facebook DOM selectors live here. Facebook's markup is obfuscated and
// changes often, so keep them in one place and prefer role/aria attributes.

// Verified: <div role="article" aria-label="Comment by <name> 28 minutes ago">
export const COMMENT_SELECTOR =
  '[role="article"][aria-label^="Comment by"], [role="article"][aria-label^="Reply by"]'
// Verified against a real page: <div aria-label="Comment as <name>"
// contenteditable="true" role="textbox" data-lexical-editor="true">
export const COMMENT_EDITOR_SELECTOR =
  '[contenteditable="true"][role="textbox"][data-lexical-editor="true"][aria-label*="comment" i]'
// Comments and replies are themselves role=article, so the main comment box is
// the editor that is NOT inside one of these.
export const COMMENT_OR_REPLY_SELECTOR = COMMENT_SELECTOR
export const TYPEAHEAD_OPTION_SELECTOR = '[role="listbox"] [role="option"]'
export const EXPAND_BUTTON_PATTERN =
  /^(view (more|previous) comments?|view \d+ (more )?repl(y|ies)|\d+ repl(y|ies))/i
export const MENTION_BUTTON_ATTR = "data-fb-mention-all"
