"use client";

import * as React from "react";

/**
 * Registers the service worker — production only. Dev stays SW-free so
 * hot-reloaded chunks can never be served stale (the classic PWA-in-dev
 * trap), and registration failure is silently ignored: the app works
 * identically without it, offline reopening is the only difference.
 */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
