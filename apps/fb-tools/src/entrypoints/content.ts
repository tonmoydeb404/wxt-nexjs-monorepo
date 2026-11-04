import { mountMentionButtons } from "@/features/mention-all"
import { requestAccessState, watchAccessState } from "@/lib"

export default defineContentScript({
  matches: ["*://*.facebook.com/*"],
  async main(ctx) {
    let stop: (() => void) | null = null
    let invalidated = false

    const unwatch = watchAccessState((state) => {
      if (state.signedIn && state.enabled) {
        if (!stop && !invalidated) stop = mountMentionButtons()
      } else if (stop) {
        stop()
        stop = null
      }
    })

    ctx.onInvalidated(() => {
      invalidated = true
      unwatch()
      stop?.()
    })

    const state = await requestAccessState()
    if (state?.signedIn && state.enabled && !stop && !invalidated) {
      stop = mountMentionButtons()
    }
  },
})
