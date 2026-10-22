import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/public-sans/wght.css";
import "./styles/app.css";
import { applySavedTheme } from "./lib/theme";

applySavedTheme();

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

const root = createRoot(container);

if (import.meta.env.DEV) {
  void import("./dev/Gallery").then(({ Gallery }) => {
    root.render(
      <StrictMode>
        <Gallery />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <h1>CarePlan Scheduler</h1>
    </StrictMode>,
  );
}
