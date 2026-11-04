import { useClerk, useUser } from "@clerk/chrome-extension"

import { Button } from "@workspace/ui/components/button"

export function AccessDisabledView() {
  const { user } = useUser()
  const clerk = useClerk()
  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Access disabled</h1>
        <p className="text-sm text-muted-foreground">
          {email ? `${email} no longer has access to FB Mention All. ` : ""}
          Contact support if you think this is a mistake.
        </p>
      </header>
      <Button variant="outline" onClick={() => void clerk.signOut()}>
        Sign out
      </Button>
    </div>
  )
}
