import React from "react";
import ReactDOM from "react-dom/client";
import { CalendarPage, MemoWindowPage } from "./pages";
import { hydrateFromDisk } from "./utils";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

const bootstrap = async () => {
  // `npm run dev` in a plain browser: stand in for the Tauri runtime so the UI
  // still renders. Compiled out of production builds.
  if (import.meta.env.DEV && !("__TAURI_INTERNALS__" in window)) {
    const { installBrowserPreviewMocks } = await import("./dev/browserPreview");
    installBrowserPreviewMocks();
  }

  // The app reads localStorage synchronously while rendering, so the files on
  // disk must be reconciled into it first.
  await hydrateFromDisk();

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {windowType === "memo" ? <MemoWindowPage /> : <CalendarPage />}
    </React.StrictMode>
  );
};

void bootstrap();
