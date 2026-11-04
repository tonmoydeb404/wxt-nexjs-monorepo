import { useClerk } from "@clerk/chrome-extension"

import { Button } from "@workspace/ui/components/button"

type DeviceBlockedViewProps = {
  // Center the card for full-page contexts (options page).
  centered?: boolean
}

export function DeviceBlockedView({ centered = false }: DeviceBlockedViewProps) {
  const clerk = useClerk()

  return (
    <div
      className={
        centered
          ? "flex min-h-screen flex-col items-center justify-center p-8"
          : "flex w-full flex-col gap-4 p-4"
      }
    >
      <div
        className={
          centered
            ? "flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center"
            : "flex w-full flex-col gap-4"
        }
      >
        <header>
          <h1 className="font-heading text-lg font-medium">
            Account in use on another device
          </h1>
          <p className="text-sm text-muted-foreground">
            This account is locked to a different browser. Contact support to
            move your access to this device.
          </p>
        </header>
        <Button variant="outline" onClick={() => void clerk.signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
