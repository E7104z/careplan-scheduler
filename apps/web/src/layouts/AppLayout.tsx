import { Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "../features/auth/authContext";
import { RequireAuth, RequireVerified } from "../features/auth/guards";
import { Button } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { Menu } from "../ui/Menu";
import { PageLoading } from "../ui/PageLoading";
import { SkipLink } from "../ui/SkipLink";

/** The signed-in shell's header: logo and the account menu. Prompt 9 adds the navigation. */
function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = user?.displayName || user?.email || "";

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left))] py-3">
          <Link to="/app" className="rounded-sm" aria-label="CarePlan Scheduler home">
            <Logo />
          </Link>
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
        </div>
      </header>
      <main id="main" className="flex-1">
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

/** Every `/app` page: signed in (APP-SPEC 3), with a verified email. */
export function AppLayout() {
  return (
    <RequireAuth>
      <RequireVerified>
        <AppShell />
      </RequireVerified>
    </RequireAuth>
  );
}
