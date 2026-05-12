import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-base">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-none border border-border-default rounded-xl bg-bg-surface',
            headerTitle: 'font-display text-text-primary',
            formButtonPrimary: 'bg-accent-primary hover:bg-accent-primary/90',
          },
        }}
      />
    </main>
  )
}
