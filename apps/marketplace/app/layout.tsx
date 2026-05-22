import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, DM_Mono, Geist } from 'next/font/google'
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from '@clerk/nextjs';
import { NextSSRPlugin } from '@uploadthing/react/next-ssr-plugin';
import { extractRouterConfig } from 'uploadthing/server';
import { ourFileRouter } from '@/app/api/uploadthing/core';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const geist = Geist({subsets:['latin'],variable:'--font-sans'})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: "Vendra | Multi-Vendor Marketplace",
  description: "A premium multi-vendor e-commerce platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html 
        lang="en" 
        className={cn("h-full", "antialiased", playfair.variable, dmMono.variable, "font-sans", geist.variable)}
      >
        <body className="min-h-full flex flex-col font-sans">
          <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
