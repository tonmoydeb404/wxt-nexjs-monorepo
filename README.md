# Browser Extension Template

A pnpm + Turborepo monorepo template for building browser extensions with
[WXT](https://wxt.dev), React, and a shared [shadcn/ui](https://ui.shadcn.com)
component library — plus an optional Next.js marketing/companion site.

## Structure

- `apps/fb-tools` — the browser extension (WXT + React)
- `apps/web` — Next.js marketing site / companion web app
- `packages/ui` — `@workspace/ui`, shared shadcn/ui components
- `packages/eslint-config` — shared ESLint flat configs
- `packages/typescript-config` — shared tsconfig presets

## Getting started

```bash
pnpm install
pnpm dev              # runs extension + web app dev servers via turbo
pnpm --filter @workspace/fb-tools dev   # extension only
pnpm --filter web dev                    # web app only
```

## Customizing

1. Update `apps/fb-tools/wxt.config.ts` with your extension's name and
   description.
2. Replace the popup UI in `apps/fb-tools/src/views/popup/index.tsx`.
3. Update `apps/web/src/lib/site-config.ts` to change all marketing site copy.
4. Add shared UI components with:

   ```bash
   pnpm dlx shadcn@latest add button -c apps/web
   ```

   Components are written to `packages/ui/src/components`.

## Commands

```bash
pnpm build       # build all apps
pnpm dev         # dev servers for all apps
pnpm lint        # eslint across the workspace
pnpm format      # prettier --write
pnpm typecheck   # tsc --noEmit across the workspace
pnpm clean:workspace   # remove node_modules, caches, and build artifacts
```
