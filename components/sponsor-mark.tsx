"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A sponsor's mark.
 *
 * Nothing in the corpus stores a logo, so this derives one from the product's own
 * domain and falls back to its initial when there is no favicon to fetch — which is
 * why it has to be a client component.
 */
export function SponsorMark({
  name,
  homepageUrl,
  className,
}: {
  name: string;
  homepageUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  let host: string | null = null;
  if (homepageUrl) {
    try {
      host = new URL(homepageUrl).hostname;
    } catch {
      host = null;
    }
  }

  const base = cn(
    "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background",
    className,
  );

  if (!host || failed) {
    return (
      <span className={base} title={name} aria-hidden>
        <span className="text-[0.625rem] font-semibold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      </span>
    );
  }

  return (
    <span className={base} title={name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        className="size-full object-contain p-0.5"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
