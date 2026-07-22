"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Spinner } from "@/components/feedback/loading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useUpdateProfile } from "@/features/profile/hooks/use-update-profile";
import type { User } from "@/types/auth";

const profileSchema = z.object({
  full_name: z.string().min(2, "Please enter your name").max(120),
  phone: z.string().max(30, "Phone number is too long").optional().or(z.literal("")),
});

type ProfileValues = z.infer<typeof profileSchema>;

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ProfileForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user.full_name,
      phone: user.phone ?? "",
    },
  });

  function onSubmit(values: ProfileValues) {
    update.mutate({
      full_name: values.full_name,
      phone: values.phone || null,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profile</CardTitle>
        <CardDescription>How you appear to people you match with.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name} />
            <AvatarFallback className="text-base">
              {initials(user.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Phone{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormDescription>
                    Only shared after a confirmed match.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={update.isPending || !form.formState.isDirty}
            >
              {update.isPending ? <Spinner /> : null}
              Save changes
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
