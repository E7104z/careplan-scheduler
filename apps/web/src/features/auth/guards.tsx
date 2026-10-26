import { type ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router";
import { PageLoading } from "../../ui/PageLoading";
import { useAuth } from "./authContext";
import { safeNext } from "./next";

function here(location: { pathname: string; search: string }): string {
  return encodeURIComponent(`${location.pathname}${location.search}`);
}

/** Signed out → /sign-in?next=<this page>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, leaving } = useAuth();
  const location = useLocation();
  if (loading || leaving) return <PageLoading />;
  if (!user) return <Navigate to={`/sign-in?next=${here(location)}`} replace />;
  return children;
}

/** Signed in with an unverified email → /verify-email?next=<this page>. Google accounts arrive verified. */
export function RequireVerified({ children }: { children: ReactNode }) {
  const { user, emailVerified } = useAuth();
  const location = useLocation();
  if (user && !emailVerified) return <Navigate to={`/verify-email?next=${here(location)}`} replace />;
  return children;
}

/**
 * On the sign-in and sign-up pages: someone already signed in goes on to `next` (if safe) or
 * /app. `hold` keeps the page while a sign-up is still finishing its steps.
 */
export function RedirectSignedIn({ children, hold = false }: { children: ReactNode; hold?: boolean }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  if (loading) return <PageLoading />;
  if (user && !hold) return <Navigate to={safeNext(searchParams.get("next"))} replace />;
  return children;
}
