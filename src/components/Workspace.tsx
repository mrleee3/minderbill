import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDesktop } from "../lib/useDesktop";
import { Sheet } from "./Sheet";

const Guard = createContext<{ setDirty: (id: string, dirty: boolean) => void; leave: () => boolean }>({ setDirty: (_id: string, _dirty: boolean) => {}, leave: () => true });
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const forms = useRef(new Map<string, boolean>());
  const setDirty = useCallback((id: string, dirty: boolean) => { if (dirty) forms.current.set(id, true); else forms.current.delete(id); }, []);
  const leave = useCallback(() => !forms.current.size || window.confirm("Discard unsaved changes before leaving this entry?"), []);
  useEffect(() => {
    const check = (event: BeforeUnloadEvent) => { if (forms.current.size) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", check);
    return () => window.removeEventListener("beforeunload", check);
  }, []);
  return <Guard.Provider value={{ setDirty, leave }}>{children}</Guard.Provider>;
}
export function useWorkspaceNavigation() { return useContext(Guard).leave; }
export function useWorkspaceForm(value: string) {
  const desktop = useDesktop();
  const id = useId();
  const baseline = useRef(value);
  const { setDirty } = useContext(Guard);
  useEffect(() => { setDirty(id, desktop && baseline.current !== value); return () => setDirty(id, false); }, [id, value, desktop, setDirty]);
  return () => { baseline.current = value; setDirty(id, false); };
}

export function WorkspaceDetail({ open, title, onClose, children, empty = "Select a child to get started." }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; empty?: string;
}) {
  const desktop = useDesktop();
  // Keep the same mounted form when resizing between panel and mobile sheet.
  const [container] = useState(() => document.createElement("div"));
  const [retained, setRetained] = useState(open);
  const lastChildren = useRef(children);
  useLayoutEffect(() => { if (open) lastChildren.current = children; });
  useEffect(() => {
    if (open) { setRetained(true); return; }
    const timer = setTimeout(() => setRetained(false), 280);
    return () => clearTimeout(timer);
  }, [open]);
  const attach = useCallback((element: HTMLDivElement | null) => { if (element) element.appendChild(container); }, [container]);
  const contents = <div ref={attach} />;
  return <>
    {desktop ? <aside className="workspace-detail" aria-label={open ? title : "Details"}>
      <div className="workspace-detail-head"><h2>{open ? title : "Your workspace"}</h2>{open && <button type="button" className="sheet-close" aria-label="Close details" onClick={onClose}>✕</button>}</div>
      <div className="workspace-detail-body">{open ? contents : <div className="workspace-empty"><p>{empty}</p><span>The list stays here while you work.</span></div>}</div>
    </aside> : <Sheet open={open} title={title} onClose={onClose}>{contents}</Sheet>}
    {createPortal(open ? children : retained ? lastChildren.current : null, container)}
  </>;
}
