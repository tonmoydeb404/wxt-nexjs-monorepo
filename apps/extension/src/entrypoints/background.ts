import { DEFAULT_SETTINGS, settingsItem } from "@/lib"

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    const current = await settingsItem.getValue()
    await settingsItem.setValue({ ...DEFAULT_SETTINGS, ...current })
  })
})
