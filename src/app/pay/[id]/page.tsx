import { PayView } from "@/views/pay";

// Nothing here is knowable at build or request time on the server — the
// invoice is opaque ciphertext until the browser decrypts it with the key
// from the URL fragment, which the server never sees. Caching this route
// would only cache the loading shell.
export const dynamic = "force-dynamic";

export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PayView id={id} />;
}
