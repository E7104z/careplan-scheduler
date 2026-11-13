import { lazy, Suspense } from "react";
import { createBrowserRouter, useSearchParams } from "react-router";
import { Gallery } from "./dev/Gallery";
import { PublicLayout } from "./layouts/PublicLayout";
import { NotFound } from "./pages/NotFound";
import { PageLoading } from "./ui/PageLoading";

// APP-SPEC 10: each public page is its own chunk, so the entry holds only the shell and every
// page loads just what it uses. check-bundle.mjs measures the entry and each of these pages.
const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const Rules = lazy(() => import("./pages/Rules").then((module) => ({ default: module.Rules })));
const Privacy = lazy(() => import("./pages/Privacy").then((module) => ({ default: module.Privacy })));
const QuickSchedule = lazy(() =>
  import("./features/quick-schedule/QuickSchedule").then((module) => ({ default: module.QuickSchedule })),
);

// APP-SPEC 3 and D-06: everything that uses Firebase sits under AuthRoot, a lazy chunk, so the
// public pages never load it.
const AuthRoot = lazy(() => import("./features/auth/AuthRoot").then((module) => ({ default: module.AuthRoot })));
const AuthLayout = lazy(() => import("./layouts/AuthLayout").then((module) => ({ default: module.AuthLayout })));
const AppLayout = lazy(() => import("./layouts/AppLayout").then((module) => ({ default: module.AppLayout })));
const SignIn = lazy(() => import("./features/auth/SignIn").then((module) => ({ default: module.SignIn })));
const SignUp = lazy(() => import("./features/auth/SignUp").then((module) => ({ default: module.SignUp })));
const ResetPassword = lazy(() =>
  import("./features/auth/ResetPassword").then((module) => ({ default: module.ResetPassword })),
);
const VerifyEmail = lazy(() => import("./features/auth/VerifyEmail").then((module) => ({ default: module.VerifyEmail })));
const Account = lazy(() => import("./features/auth/Account").then((module) => ({ default: module.Account })));
const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const AgencyDetails = lazy(() =>
  import("./features/agency/AgencyDetails").then((module) => ({ default: module.AgencyDetails })),
);
const Baa = lazy(() => import("./features/agency/Baa").then((module) => ({ default: module.Baa })));
const Team = lazy(() => import("./features/agency/Team").then((module) => ({ default: module.Team })));
const NewAgency = lazy(() => import("./features/agency/NewAgency").then((module) => ({ default: module.NewAgency })));
const Join = lazy(() => import("./features/agency/Join").then((module) => ({ default: module.Join })));
// The membership guards load with the signed-in pages, not the public entry.
const RequireMembership = lazy(() =>
  import("./features/agency/guards").then((module) => ({ default: module.RequireMembership })),
);
const RequireNoMembership = lazy(() =>
  import("./features/agency/guards").then((module) => ({ default: module.RequireNoMembership })),
);

function Root() {
  const [searchParams] = useSearchParams();
  if (import.meta.env.DEV && searchParams.has("gallery")) {
    return <Gallery />;
  }
  return <PublicLayout />;
}

export const routes = [
  {
    path: "/",
    element: <Root />,
    children: [
      { index: true, element: <Landing /> },
      { path: "quick", element: <QuickSchedule /> },
      { path: "rules", element: <Rules /> },
      { path: "privacy", element: <Privacy /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    element: (
      <Suspense fallback={<PageLoading />}>
        <AuthRoot />
      </Suspense>
    ),
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: "sign-in", element: <SignIn /> },
          { path: "sign-up", element: <SignUp /> },
          { path: "reset-password", element: <ResetPassword /> },
          { path: "verify-email", element: <VerifyEmail /> },
          { path: "join/:inviteId", element: <Join /> },
        ],
      },
      {
        path: "app",
        element: <AppLayout />,
        children: [
          { index: true, element: <RequireMembership><Home /></RequireMembership> },
          { path: "account", element: <Account /> },
          { path: "quick", element: <RequireMembership><QuickSchedule /></RequireMembership> },
          { path: "agency", element: <RequireMembership><AgencyDetails /></RequireMembership> },
          { path: "agency/baa", element: <RequireMembership><Baa /></RequireMembership> },
          { path: "agency/members", element: <RequireMembership><Team /></RequireMembership> },
          { path: "new-agency", element: <RequireNoMembership><NewAgency /></RequireNoMembership> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
