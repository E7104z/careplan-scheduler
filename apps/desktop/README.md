# CarePlan Scheduler for Windows

A Windows app for CarePlan Scheduler. It's one window onto the live site,
<https://careplan-scheduler.vercel.app>: no schedule logic, no storage of its own and no copy of
the web app (`.clinerules` D-1). Every Vercel deploy updates it, and sign-in, the rules and Quick
Schedule behave exactly as on the web.

## Build the installer on Windows

From the repository root, with Node 22:

```
npm ci
npm run dist -w @careplan/desktop
```

The installer lands in `apps/desktop/release/CarePlan-Scheduler-Setup-0.1.0.exe` (about 115 MB).
`release/win-unpacked/` holds the same app unpacked, for a quick try without installing.

To build it on GitHub instead: Actions → **Desktop** → **Run workflow**, then download the
`windows-installer` artifact from the run. Pushing a tag such as `desktop-v0.1.0` also attaches
the installer to a GitHub Release for that tag.

The installer asks where to install (per user, no administrator rights needed), and adds a
desktop shortcut and a Start menu entry.

## "Windows protected your PC"

The installer isn't code-signed yet (D-4), so Windows SmartScreen stops it the first time:
choose **More info**, then **Run anyway**. Do this only with an installer from this repository's
Actions or Releases.

## Signing (a later step)

To remove that warning, buy a code-signing certificate for Golden Care Alliance, LLC: an OV
(organization validation) certificate, or an EV (extended validation) certificate, which
SmartScreen trusts from the first download. Then add it to electron-builder's Windows settings
(`win.signtoolOptions` in `electron-builder.yml`, with the certificate and its password kept in
GitHub Actions secrets, never in the repository). No signing settings are in this repository yet.

## How the app behaves

- **What loads in the window** (D-3, `src/config.ts`): https pages on the site, and Google
  sign-in (`accounts.google.com`, `care-plan-scheduler.firebaseapp.com`), which opens in a child
  window that closes itself. Lookalike hosts, other schemes and other ports don't load.
- **Other links** open in the person's own browser (https) or mail app (`mailto:`, the support
  address and the invite's "open your mail app" link). Nothing else is handed to Windows.
- **Permissions** (D-2): every request is refused but one: the site writing text to the clipboard,
  so "Copy invite link" works as it does in a browser. No camera, microphone, location or
  notifications.
- **Window security** (D-2): `contextIsolation`, `sandbox` and `webSecurity` on, `nodeIntegration`
  off, no preload script. The installed app also has Electron's fuses set: it can't be run as Node
  or opened to a debugger, and loads only its own integrity-checked `app.asar`. Developer tools are
  only there while developing.
- **Offline**: if the site can't load, `assets/offline.html` says so. **Try again** loads the site,
  and so does View → Reload.
- **Print**: the page's own Print schedule button, or File → Print, opens the Windows print
  dialog, so printed schedules match the web version.
- **One window**: opening the app again brings the open window forward.
- No auto-update, telemetry or crash reporting (D-4).

## Develop

```
npm run build -w @careplan/desktop      # compile src/ to dist/
npm test -w @careplan/desktop           # config, menu and offline page tests
npx electron apps/desktop               # run it unpacked, with developer tools
```

The icon (`assets/icon.ico`, 16 to 256 px) is drawn from the logo in `apps/web/src/ui/Logo.tsx`:
`python apps/desktop/scripts/make-icon.py` (needs Pillow) redraws it.
