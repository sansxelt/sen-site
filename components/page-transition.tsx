"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const ENTER_MS = 500;
const EXIT_MS  = 380;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const navRef = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  /* after enter animation finishes, clear it so the exit animation can take over */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => { el.style.animation = "none"; };
    el.addEventListener("animationend", done, { once: true });
    return () => el.removeEventListener("animationend", done);
  }, []);

  /* intercept link clicks → sweep-up exit → navigate */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      const href = a.getAttribute("href");
      if (!href || href === pathname) return;
      if (href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (navRef.current) return;

      e.preventDefault();
      navRef.current = true;

      const el = ref.current;
      if (el) {
        el.style.animation = `ptOut ${EXIT_MS}ms cubic-bezier(0.16,1,0.3,1) both`;
      }

      setTimeout(() => {
        router.push(href);
        navRef.current = false;
      }, EXIT_MS);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, router]);

  return (
    <>
      <style>{`
        @keyframes ptIn {
          0%   { opacity: 0; -webkit-mask-position: 0 100%; mask-position: 0 100%; }
          15%  { opacity: 1; }
          100% { opacity: 1; -webkit-mask-position: 0 0;   mask-position: 0 0; }
        }
        @keyframes ptOut {
          0%   { opacity: 1; -webkit-mask-position: 0 0;   mask-position: 0 0; }
          85%  { opacity: 1; }
          100% { opacity: 0; -webkit-mask-position: 0 100%; mask-position: 0 100%; }
        }
      `}</style>
      <div
        ref={ref}
        style={{
          WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent)",
          maskImage: "linear-gradient(to bottom, black 50%, transparent)",
          WebkitMaskSize: "100% 300%",
          maskSize: "100% 300%",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          animation: `ptIn ${ENTER_MS}ms cubic-bezier(0.16,1,0.3,1) both`,
        }}
      >
        {children}
      </div>
    </>
  );
}
