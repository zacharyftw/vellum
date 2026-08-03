import type { Metadata, Viewport } from "next";
import { Mulish, Onest } from "next/font/google";
import localFont from "next/font/local";

import {
  generateMetadata,
  generateViewport,
} from "@/utils/seo/generate-page-metadata";
import { getSiteStructuredData } from "@/utils/seo/structured-data";

import { AdaptiveGrid } from "@/components/common/grid";
import { ReducedMotion } from "@/components/common/reduced-motion";
import { SiteHeader } from "@/components/common/site-header";
import { ScrollLayout } from "@/layouts/scroll-layout";

import "@/app/globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

/** Hero display + chrome face, per the Figma. Self-hosted from Fontshare. */
const generalSans = localFont({
  variable: "--font-general-sans",
  display: "swap",
  src: [
    { path: "./fonts/GeneralSans-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/GeneralSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-Medium.woff2", weight: "500", style: "normal" },
  ],
});

/** Hero eyebrow / tag + stat face, per the Figma. */
const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

export const metadata: Metadata = generateMetadata();
export const viewport: Viewport = generateViewport();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${onest.variable} ${generalSans.variable} ${mulish.variable}`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getSiteStructuredData()),
          }}
        />
        <ScrollLayout>
          <AdaptiveGrid />
          <ReducedMotion />
          {/* No cookie banner: Vellum sets no cookies and runs no analytics.
              Asking consent for tracking that does not exist would be theatre,
              and on a product whose whole claim is "we cannot see your data" it
              would be the wrong kind. `LazyCookie` stays in the tree for
              whenever that stops being true. */}
          {/* Fixed site-wide chrome — sits above every section. */}
          <SiteHeader />
          {children}
        </ScrollLayout>
      </body>
    </html>
  );
}
