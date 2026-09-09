import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { isHomeScreen } from "./lib/viewport";

// With viewport-fit=auto, iOS can report zero bottom inset in Home Screen
// mode. Reserve the familiar home-indicator clearance inside the tab bar.
document.documentElement.classList.toggle("ios-home-screen",
  /iPhone|iPod/.test(navigator.userAgent) && isHomeScreen(
    window.matchMedia("(display-mode: standalone)").matches,
    (navigator as Navigator & { standalone?: boolean }).standalone
  )
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
