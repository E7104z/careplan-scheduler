import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import { menuTemplate } from "./menu";

function labels(items: MenuItemConstructorOptions[]): string[] {
  return items.filter((item) => item.type !== "separator").map((item) => item.label ?? item.role ?? "");
}

function submenu(template: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const menu = template.find((item) => item.label === label || item.role === label);
  if (!menu || !Array.isArray(menu.submenu)) throw new Error(`No ${label} menu`);
  return menu.submenu;
}

const actions = () => ({ print: vi.fn(), reload: vi.fn(), openPrivacy: vi.fn() });

describe("menuTemplate", () => {
  it("has File (Print, Quit), Edit, View and Help (Open privacy page)", () => {
    const template = menuTemplate(true, actions());
    expect(template.map((item) => item.label ?? item.role)).toEqual(["File", "editMenu", "View", "Help"]);
    expect(labels(submenu(template, "File"))).toEqual(["Print…", "quit"]);
    expect(labels(submenu(template, "View"))).toEqual(["Reload", "Actual size", "Zoom in", "Zoom out", "Full screen"]);
    expect(labels(submenu(template, "Help"))).toEqual(["Open privacy page"]);
  });

  it("has no developer tools in the packaged app, and offers them while developing", () => {
    const has = (packaged: boolean) =>
      submenu(menuTemplate(packaged, actions()), "View").some((item) => item.role === "toggleDevTools");
    expect(has(true)).toBe(false);
    expect(has(false)).toBe(true);
  });

  it("runs Print, Reload and Open privacy page", () => {
    const run = actions();
    const template = menuTemplate(true, run);
    const click = (menu: string, label: string) => {
      const item = submenu(template, menu).find((entry) => entry.label === label);
      item?.click?.({} as never, undefined, {} as never);
    };
    click("File", "Print…");
    click("View", "Reload");
    click("Help", "Open privacy page");
    expect([run.print, run.reload, run.openPrivacy].map((fn) => fn.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
