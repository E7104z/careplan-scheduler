import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_URL,
  PRIVACY_URL,
  SITE_PRINT_SCRIPT,
  allowsPermission,
  isAllowedNavigation,
  opensAfterSaving,
  opensOutside,
  sitePrinted,
} from "./config";

describe("APP_URL", () => {
  it("is the production site, and the privacy page is on it", () => {
    expect(APP_URL).toBe("https://care-plan-scheduler.web.app");
    expect(PRIVACY_URL).toBe("https://care-plan-scheduler.web.app/privacy");
  });
});

describe("isAllowedNavigation (D-3)", () => {
  it("allows https pages on the site and Google sign-in's hosts", () => {
    for (const url of [
      "https://care-plan-scheduler.web.app",
      "https://care-plan-scheduler.web.app/quick",
      "https://care-plan-scheduler.web.app/join/abc123?next=%2Fapp",
      "https://CARE-PLAN-SCHEDULER.web.app/rules",
      "https://accounts.google.com/o/oauth2/auth?client_id=x",
      "https://care-plan-scheduler.firebaseapp.com/__/auth/handler?apiKey=x",
    ]) {
      expect(isAllowedNavigation(url), url).toBe(true);
    }
  });

  it("refuses lookalike hosts", () => {
    for (const url of [
      "https://care-plan-scheduler.web.app.evil.com/",
      "https://evil-care-plan-scheduler.web.app/",
      "https://care-plan-scheduler.web.app.",
      "https://care-plan-scheduler--preview.web.app/",
      "https://accounts.google.com.evil.com/",
      "https://evil.com/?next=https://care-plan-scheduler.web.app",
      "https://care-plan-scheduler.web.app@evil.com/",
    ]) {
      expect(isAllowedNavigation(url), url).toBe(false);
    }
  });

  it("refuses other schemes, other ports, credentials and anything that isn't a URL", () => {
    for (const url of [
      "http://care-plan-scheduler.web.app/",
      "file:///C:/Windows/System32/calc.exe",
      "javascript:alert(1)",
      "data:text/html,hello",
      "mailto:support@thecdscloud.com",
      "https://care-plan-scheduler.web.app:8443/",
      "https://user:pass@care-plan-scheduler.web.app/",
      "care-plan-scheduler.web.app",
      "",
      "not a url",
      "https://",
    ]) {
      expect(isAllowedNavigation(url), url).toBe(false);
    }
  });
});

describe("opensOutside", () => {
  it("opens https pages and mail links in the person's own browser or mail app", () => {
    expect(opensOutside("https://health.mo.gov/seniors/hcbs/")).toBe(true);
    expect(opensOutside("mailto:support@thecdscloud.com")).toBe(true);
    expect(opensOutside("mailto:p-test@example.com?subject=Join&body=https%3A%2F%2Fcare-plan-scheduler.web.app")).toBe(true);
  });

  it("opens nothing else", () => {
    for (const url of ["http://example.com/", "file:///C:/", "javascript:alert(1)", "ms-settings:", "tel:5555550100", "not a url"]) {
      expect(opensOutside(url), url).toBe(false);
    }
  });
});

describe("allowsPermission (D-2)", () => {
  it("allows only writing to the clipboard, and only for the site itself", () => {
    expect(allowsPermission("clipboard-sanitized-write", "https://care-plan-scheduler.web.app/app/agency/members")).toBe(true);
    expect(allowsPermission("clipboard-sanitized-write", "https://accounts.google.com/")).toBe(false);
    expect(allowsPermission("clipboard-sanitized-write", "https://care-plan-scheduler.web.app.evil.com/")).toBe(false);
    for (const permission of ["clipboard-read", "media", "geolocation", "notifications", "openExternal", "fullscreen", "unknown"]) {
      expect(allowsPermission(permission, "https://care-plan-scheduler.web.app/"), permission).toBe(false);
    }
  });
});

describe("File > Print (APP-SPEC 5.4)", () => {
  it("asks the page first: the page cancels the event when it makes its own one-page PDF", () => {
    expect(SITE_PRINT_SCRIPT).toBe('window.dispatchEvent(new Event("careplan:print", { cancelable: true }))');
    // dispatchEvent returns false only when a listener cancelled the event.
    expect(sitePrinted(false)).toBe(true);
    for (const result of [true, undefined, null, "false", 0]) expect(sitePrinted(result), String(result)).toBe(false);
  });
});

describe("opensAfterSaving", () => {
  const SITE_PDF = "blob:https://care-plan-scheduler.web.app/2f1c7a7e-4c1d-4a77-9a55-0d7b9f1e2a10";

  it("opens the site's own PDF once saved as a .pdf, so it can be printed from the PDF app", () => {
    expect(opensAfterSaving(SITE_PDF, "application/pdf", "C:\\Users\\p-test\\Downloads\\Care schedule 2026-10-26.pdf")).toBe(true);
    expect(opensAfterSaving(SITE_PDF, "application/pdf", "C:\\Users\\p-test\\Documents\\SCHEDULE.PDF")).toBe(true);
  });

  it("opens nothing else: other sources, other types, or a file saved under another extension", () => {
    for (const [url, mime, path] of [
      ["blob:https://care-plan-scheduler.web.app.evil.com/x", "application/pdf", "C:\\x.pdf"],
      ["blob:https://evil.com/x", "application/pdf", "C:\\x.pdf"],
      ["https://care-plan-scheduler.web.app/report.pdf", "application/pdf", "C:\\x.pdf"],
      [SITE_PDF, "text/html", "C:\\x.pdf"],
      [SITE_PDF, "application/pdf", "C:\\x.exe"],
      [SITE_PDF, "application/pdf", "C:\\x.pdf.exe"],
      [SITE_PDF, "application/pdf", ""],
    ] as const) {
      expect(opensAfterSaving(url, mime, path), `${url} ${mime} ${path}`).toBe(false);
    }
  });
});

describe("offline page", () => {
  const html = readFileSync(join(__dirname, "..", "assets", "offline.html"), "utf8");

  it("says it's offline, how to fix it, and tries the site again", () => {
    expect(html).toContain("<h1>You're offline</h1>");
    expect(html).toContain(
      "CarePlan Scheduler needs an internet connection to open. Check your connection, then try again.",
    );
    expect(html).toMatch(new RegExp(`<form action="${APP_URL}/" method="get">\\s*<button type="submit">Try again</button>`));
  });

  it("uses only black, white and the Signature blue, system fonts, and no scripts", () => {
    const colors = new Set((html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map((color) => color.toUpperCase()));
    expect([...colors].sort()).toEqual(["#000000", "#26348C", "#FFFFFF"]);
    expect(html).not.toMatch(/<script|<link|@import|url\(/i);
    expect(html).toContain("system-ui");
  });
});
