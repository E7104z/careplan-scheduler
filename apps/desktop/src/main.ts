import { join } from "node:path";
import { app, BrowserWindow, Menu, session, shell, type WebContents, type WebPreferences } from "electron";
import { APP_URL, PRIVACY_URL, allowsPermission, isAllowedNavigation, opensOutside } from "./config";
import { menuTemplate } from "./menu";

// D-1: a window onto the live site. No schedule logic, no storage of its own, no copy of apps/web.

const APP_ID = "com.goldencarealliance.careplan";
const OFFLINE_PAGE = join(__dirname, "..", "assets", "offline.html");
const ICON = join(__dirname, "..", "assets", "icon.ico");
/** Chromium's net::ERR_ABORTED: a load that was replaced or stopped, not a failed connection. */
const ERR_ABORTED = -3;

let mainWindow: BrowserWindow | null = null;

/** D-2, for the main window and every window the site opens (Google sign-in). */
function webPreferences(): WebPreferences {
  return {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: !app.isPackaged,
  };
}

function openOutside(url: string): void {
  if (opensOutside(url)) void shell.openExternal(url);
}

/**
 * D-3 on every web contents: an allowed URL loads in the app (a window the site opens, such as
 * Google sign-in, becomes a child window that closes itself when sign-in is done); any other
 * https or mailto: link opens in the person's own browser or mail app, and nothing else opens.
 */
function guard(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 700,
          autoHideMenuBar: true,
          ...(mainWindow ? { parent: mainWindow } : {}),
          webPreferences: webPreferences(),
        },
      };
    }
    openOutside(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event) => {
    if (isAllowedNavigation(event.url)) return;
    event.preventDefault();
    openOutside(event.url);
  });
  contents.on("did-create-window", (child) => child.removeMenu());
}

/** D-2: refuse every permission but the site writing text to the clipboard (config.ts). */
function blockPermissions(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(allowsPermission(permission, details.requestingUrl));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
    allowsPermission(permission, requestingOrigin),
  );
}

function showingOfflinePage(window: BrowserWindow): boolean {
  return window.webContents.getURL().startsWith("file:");
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    title: "CarePlan Scheduler",
    icon: ICON,
    // Shown once the first page has painted (its own light or dark theme): no white flash.
    show: false,
    webPreferences: webPreferences(),
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.on("did-fail-load", (_event, errorCode, _description, url, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED || url.startsWith("file:")) return;
    void window.loadFile(OFFLINE_PAGE);
  });
  void window.loadURL(APP_URL);
  return window;
}

function reload(): void {
  if (!mainWindow) return;
  // The offline page has nothing of its own to reload: try the site again.
  if (showingOfflinePage(mainWindow)) void mainWindow.loadURL(APP_URL);
  else mainWindow.webContents.reload();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID);
  // A second launch brings the open window forward instead of starting another app.
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on("web-contents-created", (_event, contents) => guard(contents));
  app.on("window-all-closed", () => app.quit());

  void app.whenReady().then(() => {
    blockPermissions();
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        menuTemplate(app.isPackaged, {
          print: () => mainWindow?.webContents.print(),
          reload,
          openPrivacy: () => void mainWindow?.loadURL(PRIVACY_URL),
        }),
      ),
    );
    mainWindow = createWindow();
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  });
}
