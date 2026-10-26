/**
 * The live site. The desktop app is one window onto it (D-1), so every Vercel deploy updates the
 * app, and sign-in, the rules and Quick Schedule behave exactly as on the web.
 */
export const APP_URL = "https://careplan-scheduler.vercel.app";

/** Help → Open privacy page. */
export const PRIVACY_URL = `${APP_URL}/privacy`;

/** The site, and Google sign-in: Firebase's auth handler and Google's own sign-in page. */
const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  new URL(APP_URL).host,
  "accounts.google.com",
  "care-plan-scheduler.firebaseapp.com",
]);

const APP_ORIGIN = new URL(APP_URL).origin;

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * D-3: what may load inside the app: https URLs whose host is the site's or one of Google
 * sign-in's, exactly (so not a lookalike such as careplan-scheduler.vercel.app.evil.com, another
 * port, or a URL with a user name or password in it). Anything that isn't a URL is refused.
 */
export function isAllowedNavigation(url: string): boolean {
  const parsed = parse(url);
  return (
    parsed !== null &&
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === "" &&
    ALLOWED_HOSTS.has(parsed.host)
  );
}

/**
 * What a link that doesn't load in the app may open instead, in the person's own browser or mail
 * app: https pages, and mailto: links (the support address, and "open your mail app" for an
 * invite, APP-SPEC D-09). Nothing else reaches the operating system.
 */
export function opensOutside(url: string): boolean {
  const parsed = parse(url);
  return parsed !== null && (parsed.protocol === "https:" || parsed.protocol === "mailto:");
}

/**
 * File > Print asks the page first (APP-SPEC 5.4): Quick Schedule makes its one-page PDF and
 * cancels this event; any other page leaves it, and the app prints the page as it is.
 */
export const SITE_PRINT_SCRIPT = 'window.dispatchEvent(new Event("careplan:print", { cancelable: true }))';

/** `dispatchEvent` returns false only when the page cancelled the event: it is printing. */
export function sitePrinted(result: unknown): boolean {
  return result === false;
}

/**
 * The schedule PDF the site makes (Print schedule, Save as PDF) is saved where the person
 * chooses, then opened in their PDF app to print. Only a PDF from the site itself, and only when
 * saved as a .pdf: Windows opens a file by its extension, so a renamed file is never run.
 */
export function opensAfterSaving(url: string, mimeType: string, savePath: string): boolean {
  return url.startsWith(`blob:${APP_ORIGIN}/`) && mimeType === "application/pdf" && /\.pdf$/i.test(savePath);
}

/**
 * D-2: every permission request is refused but one: writing text to the clipboard, asked by the
 * site itself, so "Copy invite link" works as it does in a browser (which grants it without
 * asking). Reading the clipboard, the camera, location, notifications and the rest stay off.
 */
export function allowsPermission(permission: string, requestingUrl: string): boolean {
  return permission === "clipboard-sanitized-write" && parse(requestingUrl)?.origin === APP_ORIGIN;
}
