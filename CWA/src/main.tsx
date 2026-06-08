import React from "react";
import ReactDOM from "react-dom/client";
import { CalendarPage } from "./pages";
import { MemoWindowPage } from "./pages/MemoWindowPage";
import "./App.css";

const params = new URLSearchParams(window.location.search);
const windowType = params.get("window");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {windowType === "memo" ? <MemoWindowPage /> : <CalendarPage />}
  </React.StrictMode>
);