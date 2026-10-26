import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Outlet, Link, useLocation } from "react-router";
import { Menu as MenuIcon, X } from "lucide-react";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { PageLoading } from "../ui/PageLoading";
import { SkipLink } from "../ui/SkipLink";

// A message handed over by navigation ("Signed out"). Radix Toast loads only then, so it stays
// out of the public pages' bundles.
const FlashToast = lazy(() => import("../ui/FlashToast").then((module) => ({ default: module.FlashToast })));

function flashMessage(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("toast" in state)) return null;
  return typeof state.toast === "string" ? state.toast : null;
}

const primaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-brand px-4 font-semibold leading-none text-brand-on transition-colors hover:bg-brand-hover max-sm:min-h-11";
const secondaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-2 bg-surface px-4 font-semibold leading-none text-ink transition-colors hover:bg-sunk max-sm:min-h-11";
const quietLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-transparent px-4 font-semibold leading-none text-brand transition-colors hover:bg-brand-tint max-sm:min-h-11";
const navLink =
  "rounded-sm px-3 py-2 font-medium text-ink-2 transition-colors hover:bg-sunk hover:text-ink";
const phoneLink =
  "flex min-h-11 items-center rounded-sm px-3 font-medium text-ink transition-colors hover:bg-sunk";

const PHONE_LINKS = [
  { to: "/quick", label: "Quick Schedule" },
  { to: "/rules", label: "Rules and sources" },
  { to: "/sign-in", label: "Sign in" },
  { to: "/sign-up", label: "Create agency account" },
];

export function PublicLayout() {
  // Under 720px the links sit behind a disclosure button: plain links, not an app menu
  // (WAI-ARIA site navigation), and no Radix code in every public page's bundle.
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);
  const flash = flashMessage(location.state);

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      {/* Printed schedules carry their own header (APP-SPEC 5.4); the site's navigation stays off paper. */}
      <header
        className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)] print:hidden"
        onKeyDown={closeOnEscape}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left))] py-3">
          <Link to="/" className="rounded-sm" aria-label="CarePlan Scheduler home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 min-[720px]:flex">
            <Link to="/quick" className={navLink}>
              Quick Schedule
            </Link>
            <Link to="/rules" className={navLink}>
              Rules and sources
            </Link>
          </nav>
          <div className="hidden items-center gap-2 min-[720px]:flex">
            <Link to="/sign-in" className={quietLink}>
              Sign in
            </Link>
            <Link to="/sign-up" className={primaryLink}>
              Create agency account
            </Link>
          </div>
          <div className="min-[720px]:hidden">
            <Button
              ref={toggleRef}
              variant="secondary"
              size="sm"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="phone-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <MenuIcon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <nav
            id="phone-nav"
            aria-label="Menu"
            className="border-t border-line px-[max(16px,env(safe-area-inset-left))] py-2 min-[720px]:hidden"
          >
            <ul className="flex flex-col gap-1">
              {PHONE_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={phoneLink}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-line bg-surface print:hidden">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-[max(16px,env(safe-area-inset-left))] py-6 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 CarePlan Scheduler</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link to="/privacy" className="rounded-sm hover:underline">
              Privacy
            </Link>
            <Link to="/rules" className="rounded-sm hover:underline">
              Rules and sources
            </Link>
          </nav>
          <p>
            Questions:{" "}
            <a href="mailto:support@thecdscloud.com" className="rounded-sm hover:underline">
              support@thecdscloud.com
            </a>
          </p>
        </div>
      </footer>

      {flash !== null ? (
        <Suspense fallback={null}>
          <FlashToast key={location.key} message={flash} />
        </Suspense>
      ) : null}
    </div>
  );
}
