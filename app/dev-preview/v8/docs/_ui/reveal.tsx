"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { DOCS_LAYERS, DOCS_READY_ATTR } from "../_data/reveal";
import { revealInOrder } from "../../_kit/reveal-order";

// The same visual-order scheduler as the rest of the site, using the docs content layers.

export function DocsReveal() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const root = document.querySelector(".v8-docs");
    const ready = () => root?.setAttribute(DOCS_READY_ATTR, "");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { ready(); return; }
    const els = Array.from(document.querySelectorAll<HTMLElement>(DOCS_LAYERS)).filter((el) => el.getClientRects().length > 0);
    const cleanup = revealInOrder(els, "v8-drv", "--drv-d");
    ready();
    return cleanup;
  }, [pathname]);
  return null;
}

