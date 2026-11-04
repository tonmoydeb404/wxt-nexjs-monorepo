import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  manifest: {
    name: "FB Mention All",
    description: "Mention everyone who commented on a Facebook post.",
    // Pins the CRX id to edabcjlpjadjfadggegplpfnfnmmcmpf so the extension
    // origin stays stable and can be allowlisted in the Clerk dashboard
    // (chrome-extension://edabcjlpjadjfadggegplpfnfnmmcmpf).
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt/wFjplwYJyBAK6gsqdKUPyWhqt55VfgIZRM9yURihe+cR3iSwGiobGCVtKhGuArj8O27YNtJGGJJU1j/EWkr5LGDdhQGfEhh5hcvERmWCLzlMzC0XKPM0kJzM2NLepj9R+kpZEwuJyIJpyAEHX4akbyWrS5ppsfEZkC4FC1/07Ld0O9Nsa+zwfHEIIC2UHLkvqf1505C+sBP6U9MTb356Vr1x5ybDUOZjW5+MvL06/Qh17FhJLsLH/Vz6cDasMbpuFwsezS69HkBuvlMr4iWzMOvNFFPNxLqptIpgzF5dzWvRrc+/UAlytfPbfSNAf1AFYF9caGdBYzwy8hLvFL/wIDAQAB",
    permissions: ["storage", "alarms", "cookies"],
    host_permissions: ["*://*.facebook.com/*"],
    action: {
      default_title: "FB Mention All",
    },
  },
})
