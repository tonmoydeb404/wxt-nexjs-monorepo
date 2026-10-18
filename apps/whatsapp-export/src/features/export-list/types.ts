export type Contact = {
  name: string
  phone: string
}

export type ExportStatus = {
  state: "idle" | "running" | "done" | "error"
  count: number
  message: string
}

export type ExportMessage =
  | { type: "export:start"; scrollDelayMs: number; resolvePhones: boolean }
  | { type: "export:stop" }
  | { type: "export:status" }

export function isExportMessage(value: unknown): value is ExportMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false
  }
  return (
    value.type === "export:start" ||
    value.type === "export:stop" ||
    value.type === "export:status"
  )
}
