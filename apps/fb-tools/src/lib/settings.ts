import { storage } from "wxt/utils/storage"

export type MentionMode = "auto" | "manual"

export type Settings = {
  // auto: expand comments until enough people are found. manual: only read
  // the comments already expanded on the page.
  mode: MentionMode
  // Count people who wrote replies, and (in auto mode) open reply threads.
  includeReplies: boolean
  // Auto mode: stop expanding once this many new people are found.
  maxCollect: number
  // People mentioned per run.
  batchSize: number
  delayMs: number
  excludeNames: string[]
  dryRun: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  mode: "auto",
  includeReplies: false,
  maxCollect: 100,
  batchSize: 20,
  delayMs: 1200,
  excludeNames: [],
  dryRun: false,
}

export const settingsItem = storage.defineItem<Settings>("sync:settings", {
  fallback: DEFAULT_SETTINGS,
})

// Stored settings from older versions may lack newer fields.
export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) }
}

// Settings that follow popup changes while a run is in progress.
export async function watchSettings() {
  let current = await getSettings()
  const unwatch = settingsItem.watch((value) => {
    current = { ...DEFAULT_SETTINGS, ...value }
  })
  return { get: () => current, stop: unwatch }
}
