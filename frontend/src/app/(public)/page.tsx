import Link from "next/link";
import { FileText, Sparkles, Handshake, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginWithNext, ROUTES } from "@/lib/routes";

const steps = [
  {
    icon: FileText,
    title: "Report it",
    body: "A two-minute form for what you lost — or what you found.",
  },
  {
    icon: Sparkles,
    title: "AI looks for matches",
    body: "Descriptions and photos are compared continuously. You get notified.",
    ai: true,
  },
  {
    icon: Handshake,
    title: "Reunite",
    body: "Review the suggestion, confirm the match, arrange the handover.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="container flex flex-col items-center gap-6 py-16 text-center md:py-24">
        <Badge variant="ai">
          <Sparkles className="h-3 w-3" /> AI-powered matching
        </Badge>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight md:text-6xl">
          Lost something?
          <br />
          Found something?
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground md:text-lg">
          Report it in minutes. Our matching engine compares every lost and
          found report and tells you when there&apos;s a likely reunion.
        </p>
        <div className="w-full max-w-2xl space-y-3">
          <form action={ROUTES.search} className="flex flex-col gap-3 rounded-2xl border bg-background/80 p-2 shadow-sm sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                name="q"
                placeholder="Search for something you lost"
                className="h-12 border-0 bg-transparent pl-9 text-base shadow-none focus-visible:ring-0"
                aria-label="Search for a lost item"
              />
            </div>
            <Button type="submit" size="lg" className="sm:min-w-[140px]">
              Search
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={loginWithNext(ROUTES.reportFound)}>Post what you found</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={loginWithNext(ROUTES.reportLost)}>Report a lost item</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-card/50">
        <div className="container grid gap-8 py-16 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center gap-3 text-center">
              <div
                className={
                  step.ai
                    ? "flex h-12 w-12 items-center justify-center rounded-full bg-ai-gradient text-white"
                    : "flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground"
                }
              >
                <step.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">
                {i + 1}. {step.title}
              </h3>
              <p className="max-w-xs text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
