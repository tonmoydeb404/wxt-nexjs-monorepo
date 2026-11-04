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
  const [deviceBlocked, setDeviceBlocked] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isSignedIn || !user) {
      setDeviceBlocked(null)
      return
    }
    let cancelled = false
    void isDeviceAllowed(user.unsafeMetadata).then((allowed) => {
      if (!cancelled) setDeviceBlocked(!allowed)
    })
    return () => {
      cancelled = true
    }
  }, [isSignedIn, user])

  if (!isLoaded) return <PopupLoading />
  if (!isSignedIn || !user) return <SignInRequiredView />
  if (deviceBlocked === null) return <PopupLoading />
  if (deviceBlocked) return <DeviceBlockedView />
  if (!isExtensionEnabled(user.publicMetadata)) return <AccessDisabledView />
  return <SettingsView />
}
