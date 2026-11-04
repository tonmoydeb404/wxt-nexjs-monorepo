import { storage } from "wxt/utils/storage"

export type IndicatorPosition = { x: number; y: number }

// Where the user last dropped the status indicator (viewport pixels).
export const indicatorPositionItem =
  storage.defineItem<IndicatorPosition | null>("local:indicator-position", {
    fallback: null,
  })
