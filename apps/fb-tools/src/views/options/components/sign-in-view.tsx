import { SignIn } from "@clerk/chrome-extension"
import { dark } from "@clerk/themes"

export function SignInView() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <header className="text-center">
        <h1 className="font-heading text-2xl font-medium">FB Mention All</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
      <p className="max-w-sm text-center text-xs text-muted-foreground">
        Access is invite-only. Sign in with the email your account was created
        with. This page stays open, so you can check your email for the code
        and come back without losing the flow.
      </p>
    </div>
  )
}
