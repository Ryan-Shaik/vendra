import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vendra Admin',
  description: 'Administrative console for Vendra marketplace operations.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
