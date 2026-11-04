import "@workspace/ui/globals.css"
import { ClerkProvider } from "@clerk/chrome-extension"
import React from "react"
import ReactDOM from "react-dom/client"

import { OptionsView } from "@/views/options"
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
const extensionUrl = browser.runtime.getURL("/options.html")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {publishableKey ? (
      <ClerkProvider
        publishableKey={publishableKey}
        afterSignOutUrl={extensionUrl}
        signInFallbackRedirectUrl={extensionUrl}
      >
        <OptionsView />
      </ClerkProvider>
    ) : (
      <SetupRequiredView />
    )}
  </React.StrictMode>
)
