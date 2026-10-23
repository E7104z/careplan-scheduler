import { createBrowserRouter, useSearchParams } from "react-router";
import { Gallery } from "./dev/Gallery";
import { PublicLayout } from "./layouts/PublicLayout";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { Privacy } from "./pages/Privacy";
import { Rules } from "./pages/Rules";

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
      { path: "rules", element: <Rules /> },
      { path: "privacy", element: <Privacy /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
