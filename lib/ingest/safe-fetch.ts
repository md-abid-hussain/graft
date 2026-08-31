import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a URL the agent chose, without letting it reach the machine we run on.
 *
 * `ingest_source` takes a URL from a model and hands it to `fetch`. That is a
 * server-side request to an attacker-influenced address: loopback, RFC1918, and the
 * cloud metadata endpoint at 169.254.169.254 are all reachable from inside a container
 * and none of them are reachable from the internet, which is exactly what makes them
 * worth asking for.
 *
 * Four things have to hold together, and three of them are not enough:
 *
 *   1. http/https only            — `file:` reads the disk, `data:` smuggles a payload
 *   2. every resolved address is public
 *   3. re-checked on EVERY redirect hop, not just the URL we were handed
 *   4. a bounded number of hops
 *
 * (3) is the one that gets skipped. A guard that validates the original URL and then
 * lets `fetch` follow redirects on its own is decoration: the attacker controls a
 * public host, so it passes the check and answers `302 -> http://169.254.169.254/`.
 * `redirect: "manual"` is therefore not an optimisation here, it is the control.
 *
 * Residual risk, stated rather than hidden: between our `lookup()` and undici's own
 * connect, the name is resolved twice, so a DNS entry whose answer changes in that
 * window (rebinding) can still slip through. Closing it properly means pinning the
 * connection to the address we validated, which needs a custom dispatcher and careful
 * TLS/SNI handling. The bounded win here is that every hop is checked and the obvious
 * addresses are refused; the rebinding case is a narrower and much noisier attack.
 */

/** Hops after the first request. Real documentation redirects once or twice. */
const MAX_REDIRECTS = 5;

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/**
 * Is this a v4 address we refuse to talk to?
 *
 * Compared as integers rather than string prefixes: "10." also matches "100.64.0.1",
 * and "172.16." through "172.31." is not a prefix at all.
 */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // unparseable is not provably public
  }
  const [a, b] = parts as [number, number, number, number];

  return (
    a === 0 || // 0.0.0.0/8      this host
    a === 10 || // 10.0.0.0/8     private
    a === 127 || // 127.0.0.0/8    loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10  carrier NAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local — cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12  private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    (a === 192 && b === 0) || // 192.0.0.0/24   IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15  benchmarking
    a >= 224 // multicast + reserved + broadcast
  );
}

function isBlockedIPv6(address: string): boolean {
  const a = address.toLowerCase().split("%")[0]!; // drop any zone index

  // ::ffff:10.0.0.1 is 10.0.0.1 wearing a hat. Unwrap and judge it as v4, or the
  // whole v4 table above is bypassed by writing the address differently.
  //
  // BOTH spellings, because `new URL()` rewrites one into the other: the hostname of
  // `http://[::ffff:127.0.0.1]/` comes back normalised as `[::ffff:7f00:1]`. Matching
  // only the dotted form let loopback straight through — the exact shape of hole this
  // module exists to close, so it is worth the extra branch.
  const dotted = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isBlockedIPv4(dotted[1]!);

  const hex = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1]!, 16);
    const low = parseInt(hex[2]!, 16);
    return isBlockedIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }

  return (
    a === "::" ||
    a === "::1" || // loopback
    a.startsWith("fc") || // fc00::/7 unique local
    a.startsWith("fd") ||
    a.startsWith("fe8") || // fe80::/10 link-local
    a.startsWith("fe9") ||
    a.startsWith("fea") ||
    a.startsWith("feb") ||
    a.startsWith("ff") // multicast
  );
}

const isBlockedAddress = (address: string) =>
  isIP(address) === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address);

/**
 * Parse, check the scheme, and prove every address the host resolves to is public.
 *
 * `lookup(all: true)` rather than the first answer only: a name that returns both a
 * public and a private address must be refused, and taking the first would make that a
 * coin toss decided by the resolver's ordering.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`not a URL: ${raw}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`refusing ${url.protocol}//: only http and https are fetched`);
  }

  // A literal in the URL is never resolved, so check it directly.
  const literal = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (isBlockedAddress(literal)) {
      throw new BlockedUrlError(`refusing ${literal}: not a public address`);
    }
    return url;
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(url.hostname, { all: true });
  } catch {
    throw new BlockedUrlError(`could not resolve ${url.hostname}`);
  }

  if (resolved.length === 0) {
    throw new BlockedUrlError(`${url.hostname} resolves to nothing`);
  }

  for (const { address } of resolved) {
    if (isBlockedAddress(address)) {
      throw new BlockedUrlError(`refusing ${url.hostname}: resolves to ${address}`);
    }
  }

  return url;
}

/**
 * `fetch`, with the redirect chain walked by hand so each hop is validated.
 *
 * Returns the final response and the URL it actually came from — the caller stores
 * that, not the one it asked for, so a source's recorded URL is where the bytes were.
 */
export async function safeFetch(
  raw: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<{ response: Response; finalUrl: string }> {
  let current = await assertPublicUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(current, { ...init, redirect: "manual" });

    // 304 carries a Location-less non-2xx status; only treat real redirects as such.
    const isRedirect = response.status >= 300 && response.status < 400;
    const location = isRedirect ? response.headers.get("location") : null;

    if (!location) return { response, finalUrl: current.toString() };

    // Drain the redirect body so the socket is released rather than left dangling.
    await response.body?.cancel().catch(() => {});

    // Relative Locations are legal and common; resolve against the hop we are on.
    const next = new URL(location, current);
    current = await assertPublicUrl(next.toString());
  }

  throw new BlockedUrlError(`more than ${MAX_REDIRECTS} redirects from ${raw}`);
}
