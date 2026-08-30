import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * One sans, one mono.
 *
 * `--font-heading` is not a second family any more — globals.css aliases it to the
 * sans and gives headings weight and tracking in `@layer base`, so every existing
 * `font-heading` className keeps working and headings are differentiated by shape
 * rather than by typeface.
 */
const fontSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

/** `template` means pages set only their own name — the brand is owned here. */
export const metadata: Metadata = {
  title: {
    default: "Graft — an agent that learns your stack and builds with it",
    template: "%s · Graft",
  },
  description:
    "Learns with you at one hackathon. Builds with you at the next. Graft reads each stack from its own documentation, remembers it, and wires it into your repository behind a pull request you approve.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable, "font-sans")}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
