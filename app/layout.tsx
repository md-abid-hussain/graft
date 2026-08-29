import type { Metadata } from "next"
import { Geist_Mono, DM_Sans, Noto_Serif } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

/** `template` means pages set only their own name — the brand is owned here. */
export const metadata: Metadata = {
  title: {
    default: "Graft — an agent that learns your stack and builds with it",
    template: "%s · Graft",
  },
  description:
    "Learns with you at one hackathon. Builds with you at the next. Graft reads each stack from its own documentation, remembers it, and wires it into your repository behind a pull request you approve.",
}

const notoSerifHeading = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-heading",
})

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        dmSans.variable,
        notoSerifHeading.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
