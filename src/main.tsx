import React from "react";

// iOS standalone PWAs report inconsistent 100dvh depending on OS version and
// root overflow settings. window.innerHeight is ground truth for the visible
// area, so the app column is sized from that. Updated on orientation change
// and pageshow, deliberately NOT on every resize so the layout doesn't chase
// the keyboard.
function setAppHeight() {
  document.documentElement.style.setProperty("--app-h", `${window.innerHeight}px`);
}
setAppHeight();
window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 250));
window.addEventListener("pageshow", setAppHeight);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
