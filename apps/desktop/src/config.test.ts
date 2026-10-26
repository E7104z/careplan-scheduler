import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_URL, PRIVACY_URL, allowsPermission, isAllowedNavigation, opensOutside } from "./config";

describe("APP_URL", () => {
  it("is the production site, and the privacy page is on it", () => {
    expect(APP_URL).toBe("https://careplan-scheduler.vercel.app");
    expect(PRIVACY_URL).toBe("https://careplan-scheduler.vercel.app/privacy");
  });
});

describe("isAllowedNavigation (D-3)", () => {
  it("allows https pages on the site and Google sign-in's hosts", () => {
    for (const url of [
      "https://careplan-scheduler.vercel.app",
      "https://careplan-scheduler.vercel.app/quick",
      "https://careplan-scheduler.vercel.app/join/abc123?next=%2Fapp",
      "https://CAREPLAN-SCHEDULER.vercel.app/rules",
      "https://accounts.google.com/o/oauth2/auth?client_id=x",
      "https://care-plan-scheduler.firebaseapp.com/__/auth/handler?apiKey=x",
    ]) {
      expect(isAllowedNavigation(url), url).toBe(true);
    }
  });

  it("refuses lookalike hosts", () => {
    for (const url of [
      "https://careplan-scheduler.vercel.app.evil.com/",
      "https://evil-careplan-scheduler.vercel.app/",
      "https://careplan-scheduler.vercel.app.",
      "https://careplan-scheduler-git-main.vercel.app/",
      "https://accounts.google.com.evil.com/",
      "https://evil.com/?next=https://careplan-scheduler.vercel.app",
      "https://careplan-scheduler.vercel.app@evil.com/",
    ]) {
      expect(isAllowedNavigation(url), url).toBe(false);
    }
  });

  it("refuses other schemes, other ports, credentials and anything that isn't a URL", () => {
    for (const url of [
      "http://careplan-scheduler.vercel.app/",
      "file:///C:/Windows/System32/calc.exe",
      "javascript:alert(1)",
      "data:text/html,hello",
      "mailto:support@thecdscloud.com",
      "https://careplan-scheduler.vercel.app:8443/",
      "https://user:pass@careplan-scheduler.vercel.app/",
      "careplan-scheduler.vercel.app",
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
    expect(opensOutside("mailto:p-test@example.com?subject=Join&body=https%3A%2F%2Fcareplan-scheduler.vercel.app")).toBe(true);
  });

  it("opens nothing else", () => {
    for (const url of ["http://example.com/", "file:///C:/", "javascript:alert(1)", "ms-settings:", "tel:5555550100", "not a url"]) {
      expect(opensOutside(url), url).toBe(false);
    }
  });
});

describe("allowsPermission (D-2)", () => {
  it("allows only writing to the clipboard, and only for the site itself", () => {
    expect(allowsPermission("clipboard-sanitized-write", "https://careplan-scheduler.vercel.app/app/agency/members")).toBe(true);
    expect(allowsPermission("clipboard-sanitized-write", "https://accounts.google.com/")).toBe(false);
    expect(allowsPermission("clipboard-sanitized-write", "https://careplan-scheduler.vercel.app.evil.com/")).toBe(false);
    for (const permission of ["clipboard-read", "media", "geolocation", "notifications", "openExternal", "fullscreen", "unknown"]) {
      expect(allowsPermission(permission, "https://careplan-scheduler.vercel.app/"), permission).toBe(false);
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
