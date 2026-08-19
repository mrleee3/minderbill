import React from "react";

// iOS standalone PWAs report inconsistent 100dvh depending on OS version and
// root overflow settings. window.innerHeight is ground truth for the visible
// area, so the app column is sized from that. Updated on orientation change
// and pageshow, deliberately NOT on every resize so the layout doesn't chase
// the keyboard.
let lastH = 0;
function setAppHeight() {
  const h = window.innerHeight;
  if (h === lastH) return;
  lastH = h;
  document.documentElement.style.setProperty("--app-h", `${h}px`);
}
setAppHeight();
window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 250));
window.addEventListener("pageshow", setAppHeight);
window.addEventListener("load", () => {
  setAppHeight();
  // After an in-app reload iOS can report the previous viewport for a
  // moment, so keep checking briefly rather than trusting the first read.
  const started = Date.now();
  const settle = () => {
    setAppHeight();
    if (Date.now() - started < 2500) requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);
});
// Returning to the app is the other moment the viewport can have changed.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") setAppHeight();
});
window.addEventListener("focus", setAppHeight);
visualViewport?.addEventListener("resize", () => {
  // Ignore keyboard-driven shrinks; only track real viewport changes.
  if ((visualViewport?.height ?? 0) > window.innerHeight * 0.75) setAppHeight();
});

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
