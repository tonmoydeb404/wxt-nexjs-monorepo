import "@workspace/ui/globals.css"
import { ClerkProvider } from "@clerk/chrome-extension"
import React from "react"
import ReactDOM from "react-dom/client"

import { PopupView } from "@/views/popup"
import { SetupRequiredView } from "@/views/popup/components"

// Apply dark mode class based on system preference
function applyDarkMode() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  document.documentElement.classList.toggle("dark", isDark)
}

applyDarkMode()
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", applyDarkMode)

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Clerk redirects after sign-in/sign-up/sign-out. Chrome extensions have no
// http urls, so point every fallback back at the popup itself, otherwise the
// popup navigates to chrome-extension://<id>/ and shows ERR_FILE_NOT_FOUND.
const extensionUrl = browser.runtime.getURL("/popup.html")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl={extensionUrl}
        signInFallbackRedirectUrl={extensionUrl}
      >
        <PopupView />
      </ClerkProvider>
    ) : (
      <SetupRequiredView />
    )}
  </React.StrictMode>
)
