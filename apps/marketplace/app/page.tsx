"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Show, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-foreground tracking-tight">
              Vendra
            </span>
            <Badge variant="outline" className="bg-state-info/10 text-state-info border-state-info/20">
              Marketplace Storefront
            </Badge>
          </Link>

          <div className="flex items-center gap-4 font-sans text-sm font-medium">
            <Show when="signed-out">
              <Link href="/sign-in" className="text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link href="/sign-up">
                <Button variant="outline" size="sm" className="border-border">
                  Customer Sign Up
                </Button>
              </Link>
              <Link href="/sign-up?intent=vendor">
                <Button size="sm" className="bg-accent-primary text-white hover:bg-accent-primary/90 shadow-md shadow-accent-primary/20">
                  Start Selling
                </Button>
              </Link>
            </Show>

            <Show when="signed-in">
              <Link href="/vendor/dashboard">
                <Button variant="outline" size="sm" className="border-border">
                  Vendor Portal
                </Button>
              </Link>
              <UserButton />
            </Show>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center gap-12 p-8 mx-auto max-w-4xl text-center">
        <div className="space-y-6">
          <Badge className="px-3 py-1 text-xs uppercase tracking-widest bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
            Multi-Vendor E-Commerce Platform
          </Badge>
          <h1 className="font-display text-6xl font-bold text-foreground tracking-tight leading-tight">
            The Premium Marketplace Design System is Live.
          </h1>
          <p className="text-xl text-muted-foreground font-sans max-w-2xl mx-auto leading-relaxed">
            Discover curated luxury products or launch your premium digital boutique in seconds.
          </p>
        </div>

        {/* Demo / Test Guidance Cards */}
        <div className="grid sm:grid-cols-2 gap-6 w-full max-w-3xl text-left">
          <Card className="border-border bg-card shadow-xl hover:shadow-2xl transition-shadow flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-accent-primary/10 text-accent-primary">For Vendors</Badge>
              </div>
              <CardTitle className="font-display text-xl">Vendor Onboarding Flow</CardTitle>
              <CardDescription className="text-muted-foreground">
                Test the complete vendor application, store profile setup, shipping zones, and Stripe Connect integration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Show when="signed-out">
                <Link href="/sign-up?intent=vendor">
                  <Button className="w-full bg-accent-primary text-white hover:bg-accent-primary/90">
                    Test Vendor Onboarding
                  </Button>
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/vendor/onboarding/profile">
                  <Button className="w-full bg-accent-primary text-white hover:bg-accent-primary/90">
                    Go to Vendor Onboarding
                  </Button>
                </Link>
              </Show>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-xl hover:shadow-2xl transition-shadow flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-state-info/10 text-state-info">For Customers</Badge>
              </div>
              <CardTitle className="font-display text-xl">Customer Storefront</CardTitle>
              <CardDescription className="text-muted-foreground">
                Test standard customer registration, shopping cart, checkout, and order history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Show when="signed-out">
                <Link href="/sign-up">
                  <Button variant="outline" className="w-full border-border">
                    Test Customer Sign Up
                  </Button>
                </Link>
              </Show>
              <Show when="signed-in">
                <Button variant="outline" className="w-full border-border" disabled>
                  Storefront Catalog (Coming Soon)
                </Button>
              </Show>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
