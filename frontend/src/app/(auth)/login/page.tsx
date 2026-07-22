import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DemoSignIn } from "@/features/auth/components/demo-sign-in";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>
          The full sign-in form ships with the next build step.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <DemoSignIn />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href={ROUTES.register}
            className="font-medium text-primary hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
