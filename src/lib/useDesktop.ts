import { useEffect, useState } from "react";
export const DESKTOP_QUERY = "(min-width: 1100px)";
export function useDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}
