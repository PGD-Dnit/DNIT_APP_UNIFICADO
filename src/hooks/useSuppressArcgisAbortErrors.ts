// src/hooks/useSuppressArcgisAbortErrors.ts
import { useEffect } from "react";

export function useSuppressArcgisAbortErrors() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const r = event.reason;
      if (
        r &&
        (r.name === "AbortError" ||
          r.name === "cancelled:layerview-create" ||
          r.message?.includes("AbortError") ||
          r.message?.includes("layerview creation cancelled"))
      ) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);
}

