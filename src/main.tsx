import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// After an in-app reload iOS can lay out position:fixed elements against
// the previous viewport, which leaves the tab bar floating above the bottom
// until the app is force-quit. Toggling the element out of and back into the
// layout forces a fresh computation against the current viewport.
function kickTabBar() {
  const bar = document.querySelector<HTMLElement>(".tabbar");
  // Skip while a sheet is open: the bar is deliberately slid away then.
  if (!bar || document.body.classList.contains("sheet-open")) return;
  bar.style.display = "none";
  void bar.offsetHeight; // force reflow while it is out of flow
  bar.style.display = "";
}

function scheduleKicks() {
  requestAnimationFrame(kickTabBar);
  for (const delay of [80, 300, 800, 1600]) setTimeout(kickTabBar, delay);
}

window.addEventListener("load", scheduleKicks);
window.addEventListener("pageshow", scheduleKicks);
window.addEventListener("orientationchange", () => setTimeout(scheduleKicks, 250));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") scheduleKicks();
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
