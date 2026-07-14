"use client";

import { useEffect } from "react";

export function SessionBoundary() {
  useEffect(() => {
    function handleSessionEnded() {
      const destination = `${window.location.pathname}${window.location.search}`;
      window.sessionStorage.setItem("bubbleit.auth.return_to", destination);

      if (!window.location.pathname.startsWith("/account")) {
        window.location.assign(
          `/account?session=expired&returnTo=${encodeURIComponent(destination)}`,
        );
      }
    }

    window.addEventListener("bubbleit:session-ended", handleSessionEnded);
    return () => window.removeEventListener("bubbleit:session-ended", handleSessionEnded);
  }, []);

  return null;
}
