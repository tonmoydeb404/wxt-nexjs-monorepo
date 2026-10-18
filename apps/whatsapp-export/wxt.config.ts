import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "WhatsApp List Export",
    description: "Export the contacts of a WhatsApp Web list to CSV.",
    host_permissions: ["*://web.whatsapp.com/*"],
    action: {
      default_title: "WhatsApp List Export",
    },
  },
})
