/**
 * Browser-side client for `/api/invoices`.
 *
 * Only ever sends ciphertext. If a plaintext invoice field reaches this module,
 * something upstream has gone wrong.
 */
import type {
  CreateInvoiceInput,
  StoredInvoice,
  UpdateInvoiceInput,
} from "./schemas";

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
}

/** An error carrying the API's own code, so callers can branch on it. */
export class InvoiceApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "InvoiceApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new InvoiceApiError(
      "unreadable_response",
      `The server returned ${response.status} with no JSON body.`,
      response.status,
    );
  }

  if (!response.ok || envelope.error) {
    throw new InvoiceApiError(
      envelope.error?.code ?? "request_failed",
      envelope.error?.message ?? `Request failed with ${response.status}.`,
      response.status,
    );
  }
  return envelope.data as T;
}

export function createInvoice(input: CreateInvoiceInput) {
  return request<{ id: string; createdAt: string }>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchInvoice(id: string) {
  return request<StoredInvoice>(`/api/invoices/${id}`);
}

export function updateInvoice(id: string, input: UpdateInvoiceInput) {
  return request<StoredInvoice>(`/api/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
