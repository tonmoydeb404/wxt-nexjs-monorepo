import { SignIn, SignUp } from "@clerk/chrome-extension"
import { dark } from "@clerk/themes"
import { useState } from "react"

import { Button } from "@workspace/ui/components/button"

export function SignInRequiredView() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">FB Mention All</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to start mentioning everyone in the comments.
        </p>
      </header>
      {mode === "sign-in" ? (
        <SignIn appearance={isDark ? { theme: dark } : undefined} />
      ) : (
        <SignUp appearance={isDark ? { theme: dark } : undefined} />
      )}
      <Button variant="link" size="sm" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
        {mode === "sign-in"
          ? "No account yet? Sign up"
          : "Already have an account? Sign in"}
      </Button>
    </div>
  )
}
