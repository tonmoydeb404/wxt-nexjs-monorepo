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
          This account doesn&rsquo;t have access to FB Mention All yet.
          Contact support to get access.
        </p>
      </header>
      <Button variant="outline" onClick={() => void clerk.signOut()}>
        Sign out
      </Button>
    </div>
  )
}
