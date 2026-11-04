export function SetupRequiredView() {
  return (
    <div className="flex w-full flex-col gap-4 p-4">
      <header>
        <h1 className="font-heading text-lg font-medium">Setup required</h1>
        <p className="text-sm text-muted-foreground">
          Missing Clerk publishable key. Copy{" "}
          <code className="text-foreground">.env.example</code> to{" "}
          <code className="text-foreground">.env</code> and set{" "}
          <code className="text-foreground">VITE_CLERK_PUBLISHABLE_KEY</code>,
          then rebuild the extension.
        </p>
      </header>
    </div>
  )
}
