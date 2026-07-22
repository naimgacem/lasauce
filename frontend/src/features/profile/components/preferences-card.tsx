"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMounted } from "@/hooks/use-mounted";

const EMAIL_PREF_KEY = "lf-pref-email-notifications";

export function PreferencesCard() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // Device-level preference (server-side notification prefs ship later).
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  React.useEffect(() => {
    setEmailNotifications(localStorage.getItem(EMAIL_PREF_KEY) !== "off");
  }, []);

  function toggleEmail(on: boolean) {
    setEmailNotifications(on);
    localStorage.setItem(EMAIL_PREF_KEY, on ? "on" : "off");
    toast.success(on ? "Email notifications on." : "Email notifications off.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferences</CardTitle>
        <CardDescription>Appearance and notifications on this device.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor="pref-theme" className="text-sm font-medium">
              Theme
            </Label>
            <p className="text-xs text-muted-foreground">
              Light, dark, or follow your system.
            </p>
          </div>
          {mounted ? (
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger id="pref-theme" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor="pref-email" className="text-sm font-medium">
              Email notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Match alerts and important account events.
            </p>
          </div>
          <Switch
            id="pref-email"
            checked={emailNotifications}
            onCheckedChange={toggleEmail}
          />
        </div>

        <p className="px-1 text-xs text-muted-foreground">
          Motion respects your system&apos;s “reduce motion” setting automatically.
        </p>
      </CardContent>
    </Card>
  );
}
