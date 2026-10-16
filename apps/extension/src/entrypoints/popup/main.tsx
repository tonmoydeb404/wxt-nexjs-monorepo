import "@workspace/ui/globals.css"
import React from "react"
import ReactDOM from "react-dom/client"

import { PopupView } from "@/views/popup"

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

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <PopupView />
  </React.StrictMode>
)
