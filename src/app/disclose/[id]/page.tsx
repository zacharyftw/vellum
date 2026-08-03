import type { Metadata } from "next";

import { generateMetadata as buildMetadata } from "@/utils/seo/generate-page-metadata";
import { DiscloseView } from "@/views/disclose";

interface DisclosePageProps {
  params: Promise<{ id: string }>;
}

// Overrides the shared generator's default `robots: { index: true }` — this
// is a capability link (the decryption key lives in the URL fragment), not a
// page anyone should find via search.
export const metadata: Metadata = {
  ...buildMetadata({
    title: "Auditor disclosure — Vellum",
    description:
      "Prove one invoice matches what was anchored on Starknet, without revealing anything else.",
    url: "/disclose",
  }),
  robots: { index: false, follow: false },
};

export default async function DisclosePage({ params }: DisclosePageProps) {
  const { id } = await params;
  return <DiscloseView id={id} />;
}
