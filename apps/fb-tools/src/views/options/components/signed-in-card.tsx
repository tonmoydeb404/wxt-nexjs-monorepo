import { UserButton } from "@clerk/chrome-extension"

import { Button } from "@workspace/ui/components/button"

type SignedInCardProps = {
  email: string | null
}

export function SignedInCard({ email }: SignedInCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
        <UserButton />
        <h1 className="font-heading text-lg font-medium">You&rsquo;re signed in</h1>
        {email && <p className="text-sm text-muted-foreground">{email}</p>}
        <p className="text-sm text-muted-foreground">
          You can close this tab. Click the FB Mention All icon in your
          browser toolbar to use the extension.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void browser.tabs.create({ url: "https://www.facebook.com" })
          }}
        >
          Open Facebook
        </Button>
      </div>
    </div>
  )
}
