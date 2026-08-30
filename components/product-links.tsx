import { Globe } from "lucide-react";
import { safeHref } from "@/lib/utils";

/**
 * A product's outbound links, as icons.
 *
 * Shared by the hackathon card and the product card so the same product renders
 * identically wherever it appears — it is one record, and two drifting versions of its
 * link row would suggest otherwise.
 */

/** Socials are stored per product; only these three ever appear in practice. */
const SOCIALS = [
  { key: "x", label: "X", Icon: XIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon },
  { key: "youtube", label: "YouTube", Icon: YoutubeIcon },
] as const;

export function ProductLinks({
  name,
  homepageUrl,
  githubUrl,
  socials,
}: {
  name: string;
  homepageUrl?: string | null;
  githubUrl?: string | null;
  socials?: Record<string, string | undefined> | null;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {homepageUrl ? (
        <IconLink href={homepageUrl} label={`${name} homepage`}>
          <Globe className="size-3.5" />
        </IconLink>
      ) : null}
      {githubUrl ? (
        <IconLink href={githubUrl} label={`${name} on GitHub`}>
          <GithubIcon className="size-3.5" />
        </IconLink>
      ) : null}
      {SOCIALS.map(({ key, label, Icon }) => {
        const href = socials?.[key];
        return href ? (
          <IconLink key={key} href={href} label={`${name} on ${label}`}>
            <Icon className="size-3.5" />
          </IconLink>
        ) : null;
      })}
    </span>
  );
}

/** Sits inside a card's link, so it stops the click from following the card. */
export function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  // Stored URLs predate the http(s)-only write contract, so a bad scheme renders as
  // nothing rather than as a clickable one.
  const safe = safeHref(href);
  if (!safe) return null;

  return (
    <a
      href={safe}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </a>
  );
}

/** Brand marks, inline: lucide-react v1 removed its brand icon set. */
export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.9 2H22l-7.3 8.4L23 22h-6.7l-5.2-6.9L5.1 22H2l7.8-9L1.5 2h6.9l4.7 6.3L18.9 2Zm-1.1 18h1.7L7.3 3.7H5.5L17.8 20Z" />
    </svg>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.4-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z" />
    </svg>
  );
}

export function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.6h.1a4.2 4.2 0 0 1 3.8-2.1c4 0 4.8 2.6 4.8 6.1V21h-4v-5.6c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21h-4V9Z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M23.5 6.8a3 3 0 0 0-2.1-2.1C19.5 4.2 12 4.2 12 4.2s-7.5 0-9.4.5A3 3 0 0 0 .5 6.8C0 8.7 0 12 0 12s0 3.3.5 5.2a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.2.5-5.2s0-3.3-.5-5.2ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}
