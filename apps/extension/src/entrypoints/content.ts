import { mountMentionButtons } from "@/features/mention-all"

export default defineContentScript({
  matches: ["*://*.facebook.com/*"],
  main(ctx) {
    const stop = mountMentionButtons()
    ctx.onInvalidated(stop)
  },
})
