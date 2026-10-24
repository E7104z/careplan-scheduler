import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, Menu as MenuIcon, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { AgencyProvider } from "../features/agency/AgencyProvider";
import { useAgency } from "../features/agency/agencyContext";
import { useAuth } from "../features/auth/authContext";
import { RequireAuth, RequireVerified } from "../features/auth/guards";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { Menu } from "../ui/Menu";
import { PageLoading } from "../ui/PageLoading";
import { SkipLink } from "../ui/SkipLink";

const NAV = [
  { to: "/app", label: "Home", end: true },
  { to: "/app/quick", label: "Quick Schedule", end: true },
  { to: "/app/agency/members", label: "Team", end: true },
  { to: "/app/agency", label: "Agency", end: true },
];

const sidebarLink =
  "block rounded-sm px-3 py-2 font-medium text-ink-2 transition-colors hover:bg-sunk hover:text-ink";
const sidebarLinkActive = "bg-brand-tint text-brand hover:bg-brand-tint hover:text-brand";
const phoneLink =
  "flex min-h-11 items-center rounded-sm px-3 font-medium text-ink transition-colors hover:bg-sunk";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? `${sidebarLink} ${sidebarLinkActive}` : sidebarLink;
}

/** The current agency's name; when the person has several, a menu to switch (APP-SPEC 6.3). */
function AgencySwitcher() {
  const { state, switchAgency } = useAgency();
  const name = state.tenant?.name ?? "";
  if (state.memberships.length <= 1) {
    return name ? <span className="min-w-0 truncate font-semibold text-ink">{name}</span> : null;
  }
  return (
    <Menu
      label="Switch agency"
      trigger={
        <Button variant="quiet" size="sm" className="max-w-[50vw]">
          <span className="sr-only">Agency</span>
          <span className="min-w-0 truncate">{name}</span>
          <ChevronDown className="h-4 w-4 flex-none" aria-hidden="true" />
        </Button>
      }
      items={state.memberships.map((membership) => ({
        label: membership.name,
        onSelect: () => void switchAgency(membership.tenantId),
      }))}
    />
  );
}

/** The signed-in shell: agency name, account menu, and (on small screens) a nav disclosure. */
function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const name = user?.displayName || user?.email || "";

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header
        className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)]"
        onKeyDown={closeOnEscape}
      >
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left))] py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/app" className="rounded-sm" aria-label="CarePlan Scheduler home">
              <Logo showWordmark={false} />
            </Link>
            <AgencySwitcher />
          </div>
          <div className="flex items-center gap-2">
            <Menu
              label={
                <>
                  <span className="block font-semibold text-ink">{name}</span>
                  <span className="block font-normal">{user?.email}</span>
                </>
              }
              trigger={
                <Button variant="quiet" size="sm" className="max-w-[60vw]">
                  <span className="sr-only">Account menu for </span>
                  <span className="truncate">{name}</span>
                  <ChevronDown className="h-4 w-4 flex-none" aria-hidden="true" />
                </Button>
              }
              items={[
                { label: "Your account", onSelect: () => void navigate("/app/account") },
                { label: "Sign out", onSelect: () => void signOut("/", { state: { toast: "Signed out" } }) },
              ]}
            />
            <div className="lg:hidden">
              <Button
                ref={toggleRef}
                variant="secondary"
                size="sm"
                aria-label="Menu"
                aria-expanded={menuOpen}
                aria-controls="app-nav"
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
        </div>
        {menuOpen ? (
          <nav
            id="app-nav"
            aria-label="Menu"
            className="border-t border-line px-[max(16px,env(safe-area-inset-left))] py-2 lg:hidden"
          >
            <ul className="flex flex-col gap-1">
              {NAV.map(({ to, label }) => (
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
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <nav aria-label="App" className="hidden w-56 shrink-0 border-r border-line px-3 py-4 lg:block">
          <ul className="flex flex-col gap-1">
            {NAV.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className={navLinkClass}>
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main id="main" className="min-w-0 flex-1">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

/** Every `/app` page: signed in (APP-SPEC 3), verified, with the agency context loaded. */
export function AppLayout() {
  return (
    <RequireAuth>
      <RequireVerified>
        <AgencyProvider>
          <AppShell />
        </AgencyProvider>
      </RequireVerified>
    </RequireAuth>
  );
}
