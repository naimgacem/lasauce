"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
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
import { useLogin } from "@/features/auth/hooks/use-login";
import { useRegister } from "@/features/auth/hooks/use-register";
import { ApiError } from "@/types/api";

/** Mirrors the backend contract in `app/schemas/user.py` (password min 8). */
const emailField = z
  .string()
  .min(1, "Enter your email")
  .email("Enter a valid email address");

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
});

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(255, "Name is too long"),
  email: emailField,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(128, "Password is too long"),
  phone: z
    .string()
    .trim()
    .max(32, "Phone number is too long")
    .optional()
    .or(z.literal("")),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

/**
 * Map a failed auth call onto the field it belongs to, so the user is told
 * *where* the problem is rather than being handed a raw backend string.
 */
function applyAuthError(
  form: UseFormReturn<LoginValues> | UseFormReturn<RegisterValues>,
  error: unknown,
): void {
  const setRoot = (message: string) =>
    (form as UseFormReturn<LoginValues>).setError("root", { message });

  if (!(error instanceof ApiError)) {
    setRoot(error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.");
    return;
  }

  if (error.status === 401) {
    setRoot("Incorrect email or password.");
    return;
  }
  if (error.status === 409) {
    (form as UseFormReturn<LoginValues>).setError("email", {
      message: "That email is already registered. Try signing in instead.",
    });
    return;
  }
  setRoot(error.message);
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

/** Password input with a show/hide toggle. */
function PasswordInput({
  autoComplete,
  placeholder,
  ...field
}: React.ComponentProps<typeof Input> & { autoComplete: string }) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...field}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pe-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute end-0 top-0 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function LoginForm() {
  const login = useLogin();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: LoginValues) {
    form.clearErrors("root");
    login.mutate(values, { onError: (error) => applyAuthError(form, error) });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={form.formState.errors.root?.message} />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? <Spinner /> : null}
          Sign in
        </Button>
      </form>
    </Form>
  );
}

function RegisterForm() {
  const register = useRegister();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", password: "", phone: "" },
  });

  function onSubmit(values: RegisterValues) {
    form.clearErrors("root");
    register.mutate(
      {
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
      },
      { onError: (error) => applyAuthError(form, error) },
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormError message={form.formState.errors.root?.message} />

        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder="Amina Benali" {...field} />
              </FormControl>
              <FormDescription>
                Shown to the person you exchange an item with.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...field}
                />
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
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input type="tel" autoComplete="tel" placeholder="0555 12 34 56" {...field} />
              </FormControl>
              <FormDescription>Only shared after you approve a claim.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={register.isPending}>
          {register.isPending ? <Spinner /> : null}
          Create account
        </Button>
      </form>
    </Form>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  return mode === "login" ? <LoginForm /> : <RegisterForm />;
}
