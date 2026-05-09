import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-bg-base">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <h1 className="text-5xl font-bold text-text-primary tracking-tight">
          Vendra
        </h1>
        <p className="text-xl text-text-muted font-sans">
          The premium multi-vendor marketplace design system is live.
        </p>
      </div>

      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Design System Check</CardTitle>
            <Badge variant="outline" className="bg-state-info/10 text-state-info border-state-info/20">
              v4 Active
            </Badge>
          </div>
          <CardDescription>
            Verifying theme wiring and project tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-accent-primary text-white text-center text-sm font-medium">
              Accent Primary
            </div>
            <div className="p-4 rounded-md bg-accent-warm text-text-primary text-center text-sm font-medium">
              Accent Warm
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full">
              Primary Action (Green)
            </Button>
            <Button variant="outline" className="w-full">
              Secondary Action
            </Button>
          </div>
          
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-text-muted font-mono uppercase tracking-widest">
              Font Mono: ORDER-123-ABC
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
