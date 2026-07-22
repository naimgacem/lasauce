"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Sparkles, Handshake, Search, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALGERIA_WILAYAS } from "@/lib/algeria-wilayas";
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
  const [wilaya, setWilaya] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!wilaya.trim()) {
      event.preventDefault();
      return;
    }
  };

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
        <div className="w-full max-w-5xl space-y-3">
          <form
            action={ROUTES.search}
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-[28px] border bg-card/95 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.45)] backdrop-blur md:p-2"
          >
            <input type="hidden" name="wilaya" value={wilaya} required />
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1 md:border-r md:border-border/70">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="search"
                  name="q"
                  placeholder="Search for something you lost"
                  className="h-14 border-0 bg-transparent pl-11 text-base shadow-none focus-visible:ring-0"
                  aria-label="Search for a lost item"
                />
              </div>
              <div className="relative md:w-[280px]">
                <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Select name="wilaya" value={wilaya} onValueChange={setWilaya}>
                  <SelectTrigger className="h-14 border-0 bg-transparent pl-10 text-base shadow-none focus:ring-0">
                    <SelectValue placeholder="Choose a wilaya" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGERIA_WILAYAS.map((wilayaOption) => (
                      <SelectItem key={wilayaOption} value={wilayaOption}>
                        {wilayaOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={!wilaya}
                className="m-2 h-12 rounded-2xl md:m-0 md:mr-2 md:min-w-[150px]"
              >
                Search
              </Button>
            </div>
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
