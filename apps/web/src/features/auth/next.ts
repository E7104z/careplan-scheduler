/**
 * APP-SPEC 3: where to go after signing in. Only an in-app path (`/app…` or `/join/<id>`) is
 * kept; anything else (another site, `//host`, the sign-in page itself) goes to /app.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.includes("//") || next.includes("\\")) return "/app";
  if (/^\/app(?:[/?#]|$)/.test(next) || /^\/join\/[^/?#]/.test(next)) return next;
  return "/app";
}
