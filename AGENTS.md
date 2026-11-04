<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Monorepo

pnpm + Turborepo workspace. Node >= 20.

- `apps/web` — Next.js 16.2.6 app (App Router, React 19)
- `apps/fb-tools` — WXT + React browser extension
- `packages/ui` — `@workspace/ui`, shadcn components (style: `base-maia`)
- `packages/eslint-config` — shared ESLint flat configs
- `packages/typescript-config` — shared tsconfig presets

# Commands

```bash
pnpm install                     # install deps
pnpm dev                         # dev server (all packages via turbo)
pnpm --filter web dev            # dev server (web only)
pnpm --filter web typecheck      # tsc --noEmit
pnpm --filter web lint           # eslint
pnpm --filter web build          # next build
pnpm --filter web format         # prettier --write
pnpm --filter fb-tools lint     # eslint (extension)
pnpm --filter fb-tools compile  # tsc --noEmit (extension)
```

Always run typecheck + lint + build after changes. There is no test suite.

# UI components are Base UI, not Radix

shadcn is configured with `"style": "base-maia"` which uses `@base-ui/react`.
Do NOT assume Radix APIs — check `packages/ui/src/components/` for the actual
component APIs before usage.

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <name> -c apps/web
```

Components are written to `packages/ui/src/components/`, not `apps/web/src/`.

## Import convention

`@workspace/ui` uses wildcard exports — no barrel index:

```tsx
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
```

Path aliases: `@/*` → `apps/web/src/*`, `@workspace/ui/*` → `packages/ui/src/*`.

# Styling

- Tailwind v4 (CSS-first, no `tailwind.config.js`). Theme tokens in
  `packages/ui/src/styles/globals.css`.
- Dark mode: class-based (`@custom-variant dark`), toggled via `next-themes`.
- Prettier sorts Tailwind classes automatically (`cn`, `cva`).
- Icons: `@tabler/icons-react`.

# Code style

No semicolons. Double quotes. Trailing comma: es5. 2-space indent.

# Conventions

These are enforced by ESLint in `packages/eslint-config` (base.js/next.js) for
`apps/web` and `packages/ui`, and via `apps/fb-tools/eslint.config.js` for
`apps/fb-tools`, wherever practical.

1. **File names must be kebab-case** (`layout-header.tsx`, `site-config.ts`).
   Enforced by `unicorn/filename-case`.
2. **Every folder should have a single `index.ts` for barrel export**, e.g.
   `src/layout/index.ts` does `export * from "./layout-footer"`. Note:
   `@workspace/ui` is the exception — it uses wildcard exports, no barrel
   (see Import convention above).
3. **Type casting (`as X`) is not allowed.** Enforced by
   `@typescript-eslint/consistent-type-assertions` (`assertionStyle: "never"`).
   - `as const` is fine and is exempted by the rule.
   - If a cast is truly unavoidable (e.g. narrowing a DOM `EventTarget`), add
     an inline `// eslint-disable-next-line @typescript-eslint/consistent-type-assertions`
     comment explaining why.
4. **Pages must include a `metadata` export** (Next.js `Metadata` type). Base
   metadata lives in `layout.tsx`; individual `page.tsx` files add/override
   fields (e.g. `alternates.canonical`).
5. **Follow the views + app structure.** Route files under `src/app` stay thin
   and delegate to a view component under `src/views/<name>/index.tsx`:
   ```
   views/
     home/
       index.tsx
       sections/
       components/   (optional)
   ```
   Applies to both `apps/web` (App Router routes) and `apps/fb-tools`
   (entrypoint UIs, e.g. popup).
6. **Prefer named exports over default exports.** Enforced by
   `import-x/no-default-export`. Exceptions (framework-mandated default
   exports, already carved out via ESLint overrides):
   - Next.js special files: `page`, `layout`, `loading`, `error`, `not-found`,
     `template`, `route`, `global-error`, `default`, `middleware`,
     `instrumentation`, `opengraph-image`, `twitter-image`, `icon`,
     `apple-icon`, `sitemap`, `robots`.
   - WXT entrypoints under `entrypoints/**/*.ts` (`background.ts`,
     `content.ts`, ...) that default-export `defineBackground(...)` /
     `defineContentScript(...)`.
   - Tooling config files (`*.config.{js,mjs,cjs,ts,mts,cts}`, e.g.
     `eslint.config.js`, `next.config.ts`, `postcss.config.mjs`).
