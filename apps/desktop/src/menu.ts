import type { MenuItemConstructorOptions } from "electron";

export interface MenuActions {
  /** The system print dialog for the page, as its own Print button gives. */
  print: () => void;
  /** Reload the site (from the offline page too, which has nothing of its own to reload). */
  reload: () => void;
  /** Load the site's privacy page in the window. */
  openPrivacy: () => void;
}

/**
 * The app menu: File (Print, Quit), Edit, View (Reload, Actual size, Zoom in, Zoom out, Full
 * screen) and Help (Open privacy page). Developer tools only while developing, never in the
 * packaged app.
 */
export function menuTemplate(packaged: boolean, actions: MenuActions): MenuItemConstructorOptions[] {
  const view: MenuItemConstructorOptions[] = [
    { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => actions.reload() },
    { type: "separator" },
    { role: "resetZoom", label: "Actual size" },
    { role: "zoomIn", label: "Zoom in" },
    { role: "zoomOut", label: "Zoom out" },
    { type: "separator" },
    { role: "togglefullscreen", label: "Full screen" },
  ];
  if (!packaged) view.push({ type: "separator" }, { role: "toggleDevTools" });

  return [
    {
      label: "File",
      submenu: [
        { label: "Print…", accelerator: "CmdOrCtrl+P", click: () => actions.print() },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { label: "View", submenu: view },
    { label: "Help", submenu: [{ label: "Open privacy page", click: () => actions.openPrivacy() }] },
  ];
}
