import { storage } from "wxt/utils/storage"

export type Settings = {
  batchSize: number
  delayMs: number
  excludeNames: string[]
  dryRun: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  batchSize: 20,
  delayMs: 1200,
  excludeNames: [],
  dryRun: false,
}

export const settingsItem = storage.defineItem<Settings>("sync:settings", {
  fallback: DEFAULT_SETTINGS,
})
