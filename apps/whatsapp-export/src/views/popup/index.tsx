import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import type { ExportMessage, ExportStatus } from "@/features/export-list"

const IDLE: ExportStatus = { state: "idle", count: 0, message: "" }

function isStatus(value: unknown): value is ExportStatus {
  return typeof value === "object" && value !== null && "state" in value
}

async function send(message: ExportMessage): Promise<ExportStatus> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.startsWith("https://web.whatsapp.com")) {
    return {
      state: "error",
      count: 0,
      message: "Open web.whatsapp.com in the active tab.",
    }
  }
  try {
    const response: unknown = await browser.tabs.sendMessage(tab.id, message)
    return isStatus(response) ? response : IDLE
  } catch {
    return {
      state: "error",
      count: 0,
      message: "Reload the WhatsApp Web tab and try again.",
    }
  }
}

export function PopupView() {
  const [status, setStatus] = useState<ExportStatus>(IDLE)
  const [scrollDelayMs, setScrollDelayMs] = useState(700)
  const [resolvePhones, setResolvePhones] = useState(false)
  const running = status.state === "running"

  useEffect(() => {
    void send({ type: "export:status" }).then(setStatus)
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      void send({ type: "export:status" }).then(setStatus)
    }, 500)
    return () => clearInterval(id)
  }, [running])

  async function start() {
    setStatus({ state: "running", count: 0, message: "Starting…" })
    setStatus(
      await send({ type: "export:start", scrollDelayMs, resolvePhones })
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">
          WhatsApp List Export
        </h1>
        <p className="text-sm text-muted-foreground">
          Open a list in WhatsApp Web, then press Export. The list is scrolled
          automatically and a CSV is downloaded when finished.
        </p>
      </header>

      <label className="flex flex-col gap-2 text-sm">
        Delay between scrolls (ms)
        <Input
          type="number"
          min={200}
          step={100}
          value={scrollDelayMs}
          disabled={running}
          onChange={(e) => setScrollDelayMs(Number(e.target.value) || 700)}
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={resolvePhones}
          disabled={running}
          onChange={(e) => setResolvePhones(e.target.checked)}
        />
        <span>
          Read phone numbers of saved contacts
          <span className="block text-xs text-muted-foreground">
            Opens every chat one by one (slower, marks chats as read).
          </span>
        </span>
      </label>

      {running ? (
        <Button
          variant="outline"
          onClick={() => void send({ type: "export:stop" })}
        >
          Stop and save
        </Button>
      ) : (
        <Button onClick={() => void start()}>Export list</Button>
      )}

      {status.message && (
        <p
          className={
            status.state === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {status.message}
        </p>
      )}
    </div>
  )
}
