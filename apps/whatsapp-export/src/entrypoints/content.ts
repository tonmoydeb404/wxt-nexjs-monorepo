import {
  getStatus,
  isExportMessage,
  startExport,
  stopExport,
} from "@/features/export-list"

export default defineContentScript({
  matches: ["*://web.whatsapp.com/*"],
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isExportMessage(message)) return

      if (message.type === "export:start") {
        void startExport(message.scrollDelayMs, message.resolvePhones)
      } else if (message.type === "export:stop") {
        stopExport()
      }
      sendResponse(getStatus())
    })
  },
})
