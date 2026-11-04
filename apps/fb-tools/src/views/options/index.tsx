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
  // Result of the device claim for a specific user id; stale results for
  // other users are ignored during render.
  const [claim, setClaim] = useState<{ userId: string; ok: boolean } | null>(
    null
  )

  useEffect(() => {
    if (!isSignedIn || !user) return
    let cancelled = false
    void ensureDeviceClaimed(user).then((ok) => {
      if (!cancelled) setClaim({ userId: user.id, ok })
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, user])

  if (!isLoaded) return <OptionsLoading />
  if (!isSignedIn || !user) return <SignInView />
  const claimOk = claim && claim.userId === user.id ? claim.ok : null
  if (claimOk === null) return <OptionsLoading />
  if (!claimOk) return <DeviceBlockedView centered />
  return <SignedInCard email={user.primaryEmailAddress?.emailAddress ?? null} />
}
