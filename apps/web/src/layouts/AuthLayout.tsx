import { Suspense } from "react";
import { Link, Outlet } from "react-router";
import { Logo } from "../ui/Logo";
import { PageLoading } from "../ui/PageLoading";
import { SkipLink } from "../ui/SkipLink";

/** Sign-in, sign-up, reset and verify pages: one centered column, 420px wide, under the logo. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="px-[max(16px,env(safe-area-inset-left))] pb-4 pt-[max(24px,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-[420px]">
          <Link to="/" className="inline-flex rounded-sm" aria-label="CarePlan Scheduler home">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1 px-[max(16px,env(safe-area-inset-left))] pb-16 pt-4">
        <div className="mx-auto w-full max-w-[420px]">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
