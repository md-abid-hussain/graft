import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * An href safe to put in the DOM, or undefined.
 *
 * The write contract only accepts http(s), but rows predating that are still in the
 * database and a link is the one place a bad scheme executes. Belt and braces: the
 * caller renders plain text when this returns undefined.
 */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
