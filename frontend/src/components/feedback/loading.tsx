import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} />;
}

/** Centered loader for route-level / guard-level loading states. */
export function FullPageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
