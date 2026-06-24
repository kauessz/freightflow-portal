"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// ─── Inner component that uses useSearchParams (requires Suspense boundary) ──

function NavigationSpinnerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const prevRef = useRef({
    pathname,
    searchParams: searchParams.toString(),
  });

  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentPathname = pathname;
    const currentSearch = searchParams.toString();

    const changed =
      currentPathname !== prevRef.current.pathname ||
      currentSearch !== prevRef.current.searchParams;

    if (changed) {
      prevRef.current = { pathname: currentPathname, searchParams: currentSearch };

      // Clear any pending hide timers
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);

      // Show the progress bar on the next tick to avoid synchronous state updates in the effect.
      showTimerRef.current = setTimeout(() => {
        setVisible(true);
        setAnimating(false);
      }, 0);

      // Small delay so the browser has time to paint the initial state
      animTimerRef.current = setTimeout(() => setAnimating(true), 30);

      // After 500 ms hide with fade-out
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setAnimating(false);
      }, 500);
    }

    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes ff-progress-bar {
          0%   { width: 0%; opacity: 1; }
          80%  { width: 90%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        .ff-progress-animate {
          animation: ff-progress-bar 500ms ease-out forwards;
        }
      `}</style>
      <div
        aria-hidden="true"
        role="progressbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 9999,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          className={animating ? "ff-progress-animate" : ""}
          style={{
            height: "100%",
            background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
            boxShadow: "0 0 8px rgba(37, 99, 235, 0.6)",
            width: animating ? undefined : "0%",
          }}
        />
      </div>
    </>
  );
}

// ─── Exported component with Suspense boundary ────────────────────────────────

export default function NavigationSpinner() {
  return (
    <Suspense fallback={null}>
      <NavigationSpinnerInner />
    </Suspense>
  );
}
