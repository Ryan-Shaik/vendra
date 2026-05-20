export default function VendorRejectedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center
                        rounded-full bg-state-error/10">
          <span className="text-2xl">✕</span>
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Application not approved
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Unfortunately your vendor application was not approved at this time.
          You should have received an email explaining the reason.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          If you believe this was a mistake or have additional information,
          please{' '}
          <a href="mailto:support@vendra.com"
             className="text-accent-primary underline underline-offset-2">
            contact our team
          </a>
          .
        </p>
      </div>
    </main>
  )
}
