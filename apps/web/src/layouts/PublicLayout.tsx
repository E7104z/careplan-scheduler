import { Outlet, Link, useNavigate } from "react-router";
import { Menu as MenuIcon } from "lucide-react";
import { Menu } from "../ui/Menu";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { SkipLink } from "../ui/SkipLink";

const primaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-brand px-4 font-semibold leading-none text-brand-on transition-colors hover:bg-brand-hover max-sm:min-h-11";
const secondaryLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-line-2 bg-surface px-4 font-semibold leading-none text-ink transition-colors hover:bg-sunk max-sm:min-h-11";
const quietLink =
  "inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-transparent px-4 font-semibold leading-none text-brand transition-colors hover:bg-brand-tint max-sm:min-h-11";
const navLink =
  "rounded-sm px-3 py-2 font-medium text-ink-2 transition-colors hover:bg-sunk hover:text-ink";

export function PublicLayout() {
  const navigate = useNavigate();

  const menuItems = [
    { label: "Quick Schedule", onSelect: () => navigate("/quick") },
    { label: "Rules and sources", onSelect: () => navigate("/rules") },
    { label: "Sign in", onSelect: () => navigate("/sign-in") },
    { label: "Create agency account", onSelect: () => navigate("/sign-up") },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header
        className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)]"
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
            <Menu
              label="Menu"
              trigger={
                <Button variant="secondary" size="sm" aria-label="Menu">
                  <MenuIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              }
              items={menuItems}
            />
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-surface">
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
    </div>
  );
}
