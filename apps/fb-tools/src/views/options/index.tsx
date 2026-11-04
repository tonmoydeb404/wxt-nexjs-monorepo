import { useUser } from "@clerk/chrome-extension"

import { SignInView, SignedInCard } from "./components"

function OptionsLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading&hellip;
    </div>
  )
}

export function OptionsView() {
  const { isLoaded, isSignedIn, user } = useUser()

  if (!isLoaded) return <OptionsLoading />
  if (!isSignedIn || !user) return <SignInView />
  return (
    <SignedInCard
      email={user.primaryEmailAddress?.emailAddress ?? null}
    />
  )
}
