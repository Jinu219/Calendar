import React from "react";
import ReactDOM from "react-dom/client";
import { CalendarPage, MemoWindowPage } from "./pages";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {windowType === "memo" ? <MemoWindowPage /> : <CalendarPage />}
  </React.StrictMode>
);
