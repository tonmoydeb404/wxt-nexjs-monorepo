import { useUser } from "@clerk/chrome-extension"
import { useEffect, useState } from "react"

import { isDeviceAllowed, isExtensionEnabled } from "@/lib"

import {
  AccessDisabledView,
  DeviceBlockedView,
  SettingsView,
  SignInRequiredView,
} from "./components"

function PopupLoading() {
  return (
    <div className="p-4 text-sm text-muted-foreground">Loading&hellip;</div>
  )
}

export function PopupView() {
  const { isLoaded, isSignedIn, user } = useUser()
  // Result of the device check for a specific user id; stale results for
  // other users are ignored during render.
  const [deviceCheck, setDeviceCheck] = useState<{
    userId: string
    blocked: boolean
  } | null>(null)

  useEffect(() => {
    if (!isSignedIn || !user) return
    let cancelled = false
    void isDeviceAllowed(user.unsafeMetadata).then((allowed) => {
      if (!cancelled) setDeviceCheck({ userId: user.id, blocked: !allowed })
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, user])

  if (!isLoaded) return <PopupLoading />
  if (!isSignedIn || !user) return <SignInRequiredView />
  const deviceBlocked =
    deviceCheck && deviceCheck.userId === user.id ? deviceCheck.blocked : null
  if (deviceBlocked === null) return <PopupLoading />
  if (deviceBlocked) return <DeviceBlockedView />
  if (!isExtensionEnabled(user.publicMetadata)) return <AccessDisabledView />
  return <SettingsView />
}
