import { SignIn } from '@clerk/nextjs'

export default function AdminSignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm',
            card: 'bg-gray-900 border border-gray-800 shadow-xl',
            headerTitle: 'text-white',
            formButtonPrimary: 'bg-green-700 hover:bg-green-600',
          },
        }}
      />
    </main>
  )
}
