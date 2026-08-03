/**
 * The trust signal for this page: does the plaintext we just decrypted
 * reproduce the fingerprint the issuer anchored on-chain?
 *
 * A mismatch does not mean the ciphertext is unreadable (it decrypted fine) —
 * it means what decrypted is not what was committed to. That is a stronger,
 * quieter kind of tamper than a decryption failure, so it gets its own signal
 * rather than folding into the pass/fail of `decryptInvoice`.
 */
export const CommitmentBadge = ({ valid }: { valid: boolean }) => (
  <span
    className={`inline-flex items-center gap-hud-tight rounded-card border px-hud-inline py-hud-tight font-hud-mono text-hud-2xs tracking-hud uppercase ${
      valid ? "border-signal/40 text-signal" : "border-danger/40 text-danger"
    }`}
  >
    <span aria-hidden className="size-dot rounded-full bg-current" />
    {valid ? "Matches anchored commitment" : "Does not match anchored commitment"}
  </span>
);
