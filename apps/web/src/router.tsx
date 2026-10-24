import { lazy } from "react";
import { createBrowserRouter, useSearchParams } from "react-router";
import { Gallery } from "./dev/Gallery";
import { PublicLayout } from "./layouts/PublicLayout";
import { NotFound } from "./pages/NotFound";

// APP-SPEC 10: each public page is its own chunk, so the entry holds only the shell and every
// page loads just what it uses. check-bundle.mjs measures the entry and each of these pages.
const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const Rules = lazy(() => import("./pages/Rules").then((module) => ({ default: module.Rules })));
const Privacy = lazy(() => import("./pages/Privacy").then((module) => ({ default: module.Privacy })));
const QuickSchedule = lazy(() =>
  import("./features/quick-schedule/QuickSchedule").then((module) => ({ default: module.QuickSchedule })),
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
];

export const router = createBrowserRouter(routes);
