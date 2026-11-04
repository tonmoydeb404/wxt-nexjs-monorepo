import { browser } from "wxt/browser"

import { Button } from "@workspace/ui/components/button"

export function SignInRequiredView() {
  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">FB Mention All</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to start mentioning everyone in the comments.
        </p>
      </header>
      <Button onClick={() => void browser.runtime.openOptionsPage()}>
        Sign in
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Access is invite-only. Sign-in opens in a page that stays open, so the
        flow survives checking your email for the code.
      </p>
    </div>
  )
}
