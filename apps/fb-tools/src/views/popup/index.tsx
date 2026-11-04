import { useUser } from "@clerk/chrome-extension"

import { isExtensionEnabled } from "@/lib"

import { AccessDisabledView, SettingsView, SignInRequiredView } from "./components"

function PopupLoading() {
  return (
    <div className="p-4 text-sm text-muted-foreground">Loading&hellip;</div>
  )
}

export function PopupView() {
  const { isLoaded, isSignedIn, user } = useUser()

  if (!isLoaded) return <PopupLoading />
  if (!isSignedIn || !user) return <SignInRequiredView />
  if (!isExtensionEnabled(user.publicMetadata)) return <AccessDisabledView />
  return <SettingsView />
}
