import { config as reactInternalConfig } from "@workspace/eslint-config/react-internal"

import wxtAutoImports from "./.wxt/eslint-auto-imports.mjs"

/** @type {import("eslint").Linter.Config} */
export default [
  {
    ignores: [".output/**", ".wxt/**"],
  },
  ...reactInternalConfig,
  wxtAutoImports,
  {
    // WXT entrypoints (background.ts, content.ts, ...) are framework-mandated
    // to default-export the result of defineBackground/defineContentScript/etc.
    files: ["src/entrypoints/**/*.ts"],
    rules: {
      "import-x/no-default-export": "off",
    },
  },
]
