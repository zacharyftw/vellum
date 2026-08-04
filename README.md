# Vellum

Private B2B settlement on Starknet.

A supplier issues an invoice, it's encrypted in the browser, settled
on-chain, and can later be disclosed one payment at a time to an auditor —
without publishing prices, counterparties, or order flow.

## How it works

1. **Issue** — the invoice is encrypted in your browser. The server only
   ever sees ciphertext.
2. **Send** — the decryption key travels in the link, which never reaches
   our server.
3. **Settle** — the buyer pays from a shielded balance; the invoice is
   marked paid in the same transaction.
4. **Prove** — the chain holds a salted hash of the terms, not the terms
   themselves. An auditor can verify one invoice without seeing the rest.
