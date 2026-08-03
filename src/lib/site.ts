/**
 * Site-wide configuration — the single source of truth for SEO.
 *
 * Consumed by the metadata generator, `robots.ts`, `sitemap.ts`, and the
 * JSON-LD structured-data helper.
 */
import { publicEnv } from "@/env";

export const siteConfig = {
  name: "Vellum — Private settlement for business",
  description:
    "Issue an invoice, get paid on Starknet, and prove any single payment to your auditor — without publishing your prices, your counterparties, or your order book.",
  /**
   * Public origin, no trailing slash. Drives canonical URLs, OG tags, the
   * sitemap, and JSON-LD. Set `NEXT_PUBLIC_SITE_URL` in production.
   */
  url: publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Default Open Graph / Twitter share image (path under `public/`). */
  ogImage: "/open-graph.png",
  twitterHandle: "@vellum",
  author: "Vellum",
  /** Browser theme-color (address bar / PWA). Matches `--void`. */
  themeColor: "#170a2b",
} as const;
