import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  manifest: {
    name: "FB Mention All",
    description: "Mention everyone who commented on a Facebook post.",
    permissions: ["storage"],
    host_permissions: ["*://*.facebook.com/*"],
    action: {
      default_title: "FB Mention All",
    },
  },
})
