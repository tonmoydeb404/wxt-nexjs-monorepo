import { useEffect, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Slider } from "@workspace/ui/components/slider"
import { Textarea } from "@workspace/ui/components/textarea"

import {
  DEFAULT_SETTINGS,
  getSettings,
  resetAllMentioned,
  settingsItem,
  type Settings,
} from "@/lib"

export function PopupView() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    void settingsItem.setValue(next)
  }

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">FB Mention All</h1>
        <p className="text-sm text-muted-foreground">
          Open a Facebook post and press the Mention all commenters button.
        </p>
      </header>

      <div className="flex flex-col gap-2 text-sm">
        Mode
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={settings.mode === "auto" ? "default" : "outline"}
            onClick={() => update({ mode: "auto" })}
          >
            Auto expand
          </Button>
          <Button
            className="flex-1"
            variant={settings.mode === "manual" ? "default" : "outline"}
            onClick={() => update({ mode: "manual" })}
          >
            Manual
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {settings.mode === "auto"
            ? "Opens more comments for you until enough people are found."
            : "Only uses the comments you have already expanded."}
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.includeReplies}
          onChange={(e) => update({ includeReplies: e.target.checked })}
        />
        Include people who replied
      </label>

      {settings.mode === "auto" && (
        <label className="flex flex-col gap-2 text-sm">
          Max people to collect
          <Input
            type="number"
            min={1}
            value={settings.maxCollect}
            onChange={(e) =>
              update({ maxCollect: Number(e.target.value) || 100 })
            }
          />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm">
        Batch size: {settings.batchSize}
        <Slider
          min={1}
          max={50}
          value={[settings.batchSize]}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v
            if (typeof next === "number") update({ batchSize: next })
          }}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Delay between mentions (ms)
        <Input
          type="number"
          min={300}
          step={100}
          value={settings.delayMs}
          onChange={(e) => update({ delayMs: Number(e.target.value) || 1200 })}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm">
        Exclude names (one per line)
        <Textarea
          value={settings.excludeNames.join("\n")}
          onChange={(e) =>
            update({
              excludeNames: e.target.value.split("\n").filter(Boolean),
            })
          }
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.dryRun}
          onChange={(e) => update({ dryRun: e.target.checked })}
        />
        Dry run (log names only)
      </label>

      <Button variant="outline" onClick={() => update(DEFAULT_SETTINGS)}>
        Reset to defaults
      </Button>
      <Button variant="outline" onClick={() => void resetAllMentioned()}>
        Forget everyone mentioned (all posts)
      </Button>
    </div>
  )
}
