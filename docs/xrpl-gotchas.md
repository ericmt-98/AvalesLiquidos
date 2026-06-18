# XRPL escrow & credential gotchas

Hard-won lessons from building a production-shaped escrow + credentials system on the
XRP Ledger. Each item is a mistake that's easy to make, why it breaks, and the fix used
in this codebase. Most surfaced in an on-chain audit that turned a v3 design into v4.

> Verify amendment status on-chain before every milestone — voting state changes.

---

## 1. `FinishAfter + CancelAfter` creates an exploitable window

**Mistake.** Model a time-boxed escrow with `FinishAfter` (earliest finish) and
`CancelAfter` (latest), plus a `Condition`.

**Why it breaks.** Two failures: (a) a default in month 2 of a 12-month guarantee can't
be executed until `FinishAfter` — the beneficiary is unprotected for months; (b) after
`CancelAfter`, **anyone — including the debtor — can `EscrowCancel`** and the beneficiary
loses the guarantee.

**Fix.** Use **`Condition + CancelAfter` only, no `FinishAfter`**. A default is executable
at any time (present the fulfillment → `EscrowFinish`); on the happy path nobody reveals
the fulfillment and, after a 30-day margin, `EscrowCancel` returns funds to the pool.

## 2. `EscrowCancel` is gated by `CancelAfter`, not `FinishAfter`

**Mistake.** Validate a "completion/cancel" action against `FinishAfter` (or the
business expiry date).

**Why it breaks.** `EscrowCancel` is only valid **after `CancelAfter`**. Validating
against the wrong field yields `tecNO_PERMISSION` on-chain. Validating against the
business "vencimiento" instead of `CancelAfter` cancels too early.

**Fix.** Check `now >= cancelAfter` (Ripple time) before submitting `EscrowCancel`.

## 3. Disable the master key, then keep signing with it → `tefMASTER_DISABLED`

**Mistake.** Run `AccountSet asfDisableMaster` during setup, then keep signing the
account's transactions with that same master key.

**Why it breaks.** Every subsequent transaction fails with `tefMASTER_DISABLED`.

**Fix.** Mandatory order: **(1) fund → (2) `SignerListSet` → (3) disable master key →
(4) everything after is multisigned.** Autofill with the signer count so the fee scales.

## 4. `subscribe` before `client.on('transaction')`, or the listener never fires

**Mistake.** Attach `client.on('transaction', …)` and expect events.

**Why it breaks.** Without a prior `subscribe` request, the server never streams
transactions, so the handler is silent forever — a bug that looks like "it just doesn't
work" with no error.

**Fix.** `await client.request({ command: 'subscribe', accounts: [...] })` **first**,
then attach the handler. (We enforce this by structure in `subscribeAndListen`.)

## 5. Timestamps are Ripple Epoch, not Unix

**Mistake.** Pass Unix seconds to `CancelAfter`/`FinishAfter`.

**Why it breaks.** XRPL counts seconds since **2000-01-01T00:00:00Z**, so you're off by
`946684800` seconds (~30 years).

**Fix.** `rippleTime = unixSeconds − 946684800`; use `isoTimeToRippleTime` / the
`rippleTimeInDays` helper. Never hand-roll Unix math into a transaction.

## 6. `CredentialType` hex must be exact

**Mistake.** Encode the credential type loosely (or include a literal `_` byte
incorrectly), e.g. a value that decodes to garbage like `REPUTACIV…`.

**Why it breaks.** Verification silently never matches; users appear to have no
credential.

**Fix.** Encode the full ASCII string to hex. `REPUTACION_SILVER` =
`52455055544143494F4E5F53494C564552` (17 bytes; max 64). Round-trip it in a test.

## 7. Verifying a credential means **four** checks, not one

**Mistake.** Check only that a credential of the right type exists.

**Why it breaks.** You'll honor credentials from the wrong issuer, ones the user never
accepted, or expired ones.

**Fix.** Require all of: correct **Issuer**, the **`lsfAccepted`** flag (`0x00010000`),
not past **`Expiration`**, and a recognized **tier**. A user mid-tier-change (old one
deleted, new not yet accepted) correctly resolves to *no valid tier*.

## 8. MPT issuance flags — right values, and they're immutable

**Mistake.** Assume flag bits (e.g. treat `0x08` as `CanClawback`) and plan to change
them later.

**Why it breaks.** `tfMPTCanEscrow` is `0x08`; `CanClawback` is `0x40`. Getting them
wrong is **irreversible** — MPT flags can't be changed after issuance (no DynamicMPT
yet). Also, `TransferFee` must **not be present** (not even `0`) unless
`tfMPTCanTransfer` is set, or you get `temMALFORMED`.

**Fix.** Use the named constants (`MPTokenIssuanceCreateFlags.*`), never numeric
literals, and review thrice before issuing. (MPT is Phase 2 here.)

## 9. Crypto-condition encoding must be self-consistent

**Mistake.** Mix a PREIMAGE-SHA-256 condition with a mismatched fulfillment, or get the
cost suffix wrong.

**Fix.** `condition = A0258020 <sha256(preimage)> 810120`,
`fulfillment = A0228020 <preimage>`. The `810120` suffix encodes cost 32. Verify the
fulfillment hashes to the condition in a test, and **never log the fulfillment** — it's
the secret that releases funds.

## 10. Batch (XLS-56) is not available — don't design around it

**Mistake.** Plan to group multi-step flows (e.g. credential delete + create + accept)
into one Batch transaction.

**Why it breaks.** Batch is currently disabled on mainnet (a bug; `fixBatchInnerSigs` in
voting). Mitigations that assume it will silently not apply.

**Fix.** Treat such flows as **separate transactions**. They're cheap (~0.00003 XRP
each); idempotency and reconciliation matter more than atomic grouping.

---

*Found another? PRs welcome — see [CONTRIBUTING](../CONTRIBUTING.md).*
