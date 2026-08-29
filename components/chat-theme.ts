import type { ComponentProps } from "react";
import type { TrueForgeUI } from "@truefoundry/trueforge-ui";

/**
 * The SDK, wearing our theme.
 *
 * Every value is a `var()` reference rather than a literal. The SDK applies these as
 * inline styles on `.aui-theme-root`, which sits inside our own themed DOM — so each
 * one resolves against the shadcn variable of the same meaning, and light/dark follows
 * the app automatically. One map, no second palette to keep in sync.
 *
 * Hover shades come from `color-mix` because shadcn ships no hover tokens; mixing
 * toward the foreground darkens in light mode and lightens in dark, which is the
 * behaviour we want in both.
 */

type Theme = NonNullable<ComponentProps<typeof TrueForgeUI>["theme"]>;

export const CHAT_TOKENS: NonNullable<Theme["tokens"]> = {
  // Across the product
  sidebarBg: "var(--sidebar)",
  topbarBg: "var(--background)",
  primaryBg: "var(--background)",
  secondaryBg: "var(--secondary)",
  // `--border` and `--radius` are the SDK's own token names too, so these read
  // from aliases instead — pointing them at ours would be a self-reference.
  border: "var(--color-border)",
  // Literal rather than `var(--font-sans)`: next/font defines that variable through a
  // class on <html>, and it does not substitute into the SDK's inline style. The family
  // name is what next/font loads in app/layout.tsx — keep the two in step.
  fontFamily: '"Geist", ui-sans-serif, system-ui, sans-serif',

  // Building blocks
  inputBoxBg: "var(--card)",
  inputBorder: "var(--color-border)",
  textPrimary: "var(--foreground)",
  textSecondary: "var(--muted-foreground)",
  cardBg: "var(--card)",
  dropdownSelectedItemBg: "var(--accent)",
  dropdownSelectedItemText: "var(--accent-foreground)",

  // Chat
  userMessageBg: "var(--primary)",
  userMessageText: "var(--primary-foreground)",
  // Assistant text sits on the page, not in a bubble — the SDK's own default too.
  assistantMessageBg: "transparent",
  assistantMessageText: "var(--foreground)",

  // Buttons
  primaryButtonBg: "var(--primary)",
  primaryButtonHover: "color-mix(in oklab, var(--primary) 88%, var(--foreground))",
  primaryButtonText: "var(--primary-foreground)",
  secondaryButtonBg: "var(--secondary)",
  secondaryButtonHover: "var(--accent)",
  secondaryButtonText: "var(--secondary-foreground)",
  ghostButtonBg: "transparent",
  ghostButtonHover: "var(--accent)",
  ghostButtonText: "var(--foreground)",

  // Status — shadcn has no success or warning token, so these are the only literals,
  // picked to match the emerald and amber already used on the hackathon pages.
  successBg: "oklch(0.696 0.17 162.48)",
  successText: "oklch(0.98 0.01 162)",
  failureBg: "var(--destructive)",
  failureText: "oklch(0.98 0 0)",
  warningBg: "oklch(0.769 0.155 70.08)",
  warningText: "oklch(0.22 0.05 70)",

  // Kept internals
  focusRing: "var(--ring)",
  radius: "var(--app-radius)",
  composerRadius: "var(--app-radius)",
  overlay: "color-mix(in oklab, var(--background) 60%, transparent)",
  shadowColor: "color-mix(in oklab, var(--foreground) 12%, transparent)",
  scrollbarThumb: "var(--color-border)",
};

/**
 * Installed 0.2.4 takes `{ name, logo? }` only — the published docs describe a newer
 * `brand.mode` ("icon-title" / "icon-only" / "logo") that this version does not have.
 */
export const CHAT_BRAND: NonNullable<Theme["brand"]> = {
  name: "Graft",
};
