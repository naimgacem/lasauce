import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";

import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lost & Found",
    template: "%s · Lost & Found",
  },
  description:
    "Report lost items, post things you've found, and let AI help reunite people with their things.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <body className="min-h-screen bg-background font-sans">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
