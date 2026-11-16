"use client";

import { useReportWebVitals } from "next/web-vitals";
import { usePathname } from "next/navigation";

const ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/telemetry/vitals`;
const TRACKED = new Set(["LCP", "INP", "CLS", "FCP", "TTFB", "FID"]);

export function WebVitalsReporter() {
  const pathname = usePathname();

  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") return;
    if (!TRACKED.has(metric.name)) return;
    const body = JSON.stringify({
      metric: metric.name,
      value: metric.value,
      path: pathname,
      ts: Date.now(),
      rating: metric.rating,
    });
    // sendBeacon sobrevive a unload; fallback fetch keepalive.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {
      /* silent — telemetry é best-effort */
    });
  });

  return null;
}
