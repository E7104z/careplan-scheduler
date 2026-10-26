import { Suspense } from "react";
import { Outlet } from "react-router";
import { PageLoading } from "../../ui/PageLoading";
import { ToastHost } from "../../ui/ToastHost";
import { AuthProvider } from "./AuthProvider";
import { SessionTimeout } from "./SessionTimeout";

/**
 * The lazy root of every page that uses Firebase (sign-in pages and /app). Loading it is what
 * loads Firebase, so the public pages never do (APP-SPEC D-06).
 */
export function AuthRoot() {
  return (
    <AuthProvider>
      <ToastHost>
        <SessionTimeout />
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </ToastHost>
    </AuthProvider>
  );
}
