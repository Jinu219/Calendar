import React from "react";
import ReactDOM from "react-dom/client";
import { CalendarPage } from "./pages";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CalendarPage />
  </React.StrictMode>,
);
