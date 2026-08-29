"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark switch.
 *
 * Which icon shows is decided by CSS — `.dark` on the root hides one and reveals the
 * other — rather than by reading the theme during render. next-themes cannot know the
 * resolved theme on the server, so rendering from it directly means a hydration
 * mismatch, and the usual `mounted` flag to dodge that is a setState inside an effect.
 * Letting the stylesheet choose avoids both: the markup is identical on both sides.
 *
 * `resolvedTheme` is still read, but only inside the click handler, which never runs
 * during server rendering.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle light and dark"
      title="Toggle light and dark (D)"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  );
}
