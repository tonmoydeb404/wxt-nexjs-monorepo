import { SignIn } from "@clerk/chrome-extension"
import { dark } from "@clerk/themes"

export function SignInRequiredView() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">FB Mention All</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to start mentioning everyone in the comments.
        </p>
      </header>
      <SignIn
        appearance={{
          ...(isDark ? { theme: dark } : {}),
          elements: {
            // Invite-only: hide clerk's "Don't have an account? Sign up".
            footerAction: "hidden",
          },
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        Access is invite-only. Sign in with the email your account was created
        with.
      </p>
    </div>
  )
}
