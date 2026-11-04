import { useUser } from "@clerk/chrome-extension"
import { useEffect, useState } from "react"

import { ensureDeviceClaimed } from "@/lib"

import { DeviceBlockedView } from "@/views/popup/components"

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
  const [claimState, setClaimState] = useState<
    "pending" | "ok" | "blocked" | null
  >(null)

  useEffect(() => {
    if (!isSignedIn || !user) {
      setClaimState(null)
      return
    }
    let cancelled = false
    void ensureDeviceClaimed(user).then((ok) => {
      if (!cancelled) setClaimState(ok ? "ok" : "blocked")
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, user])

  if (!isLoaded) return <OptionsLoading />
  if (!isSignedIn || !user) return <SignInView />
  if (claimState === null || claimState === "pending") {
    return <OptionsLoading />
  }
  if (claimState === "blocked") return <DeviceBlockedView centered />
  return <SignedInCard email={user.primaryEmailAddress?.emailAddress ?? null} />
}
