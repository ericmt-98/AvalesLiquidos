# FAQ

Common questions about Avales Líquidos, from the basics to the harder parts. New to
XRPL or escrows? Start at the top. For common implementation pitfalls see
[`xrpl-gotchas.md`](./xrpl-gotchas.md).

---

## Basics

### What is Avales Líquidos?
Open-source reference software for issuing **rent guarantees** on the XRP Ledger. A
capital pool locks funds in an on-chain escrow in favor of a landlord; if the tenant
defaults, the landlord is paid from the escrow. The tenant pays a commission instead of
locking up their own capital.

### What real-world problem does it solve?
In Mexico, renting usually requires a *fiador* (a guarantor who owns property) or a
*póliza jurídica* (a legal rental bond costing ~1 month's rent). An *aval líquido* is a
digital, on-chain alternative: faster, transparent, and it builds portable reputation.

### What is the XRP Ledger (XRPL)?
A public, decentralized blockchain optimized for payments and tokenization. It has
**native** features for escrow, multi-signing, and credentials — so we don't need smart
contracts for the MVP; we compose built-in transaction types.

### What is an escrow?
An on-ledger lock on funds that can only be released under defined conditions. XRPL
escrows support:
- a **time** (`FinishAfter` / `CancelAfter`), and/or
- a **crypto-condition**: funds release only when someone presents the matching secret
  (the *fulfillment*).

Here the escrow is owned by the pool, its destination is the landlord, and release is
gated by a crypto-condition the operator controls.

### What is a crypto-condition and a fulfillment?
The **condition** is a public hash placed in the escrow. The **fulfillment** is the
secret (a 32-byte preimage) whose hash equals the condition. Presenting the fulfillment
in an `EscrowFinish` releases the funds. We use PREIMAGE-SHA-256. The fulfillment is the
"key" to pay out — so it's kept encrypted and never logged.

### How is this different from a normal security deposit?
A deposit locks the **tenant's** money. A *liquid guarantee* locks the **pool's** capital
and the tenant just pays a commission — so the tenant keeps their cash. (A
tenant-funded "smart deposit" is a different product we explicitly chose not to build.)

---

## Trust, custody & honesty

### Is this custodial or non-custodial?
Mixed, and we're explicit about it:
- **User wallets are self-custody** — tenants and landlords hold their own keys; the
  landlord is paid directly to their wallet.
- **The pool's capital and the execution decision are the operator's.** The fulfillment
  is held encrypted (KMS) and released only under a human **3-of-5 quorum**.

### So it's not "trustless"?
Correct — and we don't claim it is. It's **custodial-with-controls** at the operator
level. On today's XRPL you can't evaluate "did the tenant default?" on-chain, so a human
quorum decides. The design is built to migrate that decision on-chain when **XLS-100
(Smart Escrows)** ships.

### Do you (the project) run a pool or hold anyone's money?
No. This repository publishes the **rails**. Whoever deploys it operates the pool,
custodies its keys, and **assumes their own regulatory responsibility**. See
[`DISCLAIMER.md`](../DISCLAIMER.md).

### Why disable the account's master key?
The Pool Master account disables its master key and operates under a **3-of-5
multisignature** signer list, so no single key can move pool funds. (Order matters:
fund → set signer list → disable master → everything after is multisigned.)

---

## How it works (technical)

### What happens when a tenant defaults?
1. A default is reported and reviewed; the **3-of-5 quorum** approves with evidence.
2. The fulfillment is **decrypted from KMS only after** approval.
3. `EscrowFinish` releases the escrow **directly to the landlord's wallet**.
4. The tenant's reputation is downgraded.

### What happens on the happy path (no default)?
Nobody reveals the fulfillment. After `CancelAfter` (the guarantee's expiry + a 30-day
margin), anyone can submit `EscrowCancel` and the funds return to the pool. Reputation
goes up.

### Why `Condition + CancelAfter` and not `FinishAfter`?
Using `FinishAfter` would (a) block executing an early default and (b) open a window
where *anyone, including the debtor,* could cancel and void the guarantee. With
`Condition + CancelAfter` a default is executable at any time. See
[`xrpl-gotchas.md`](./xrpl-gotchas.md).

### What is a Credential / reputation tier?
Reputation is stored on-chain with **XLS-70 Credentials** in four tiers
(`bronze → silver → gold → platinum`) that set the guarantee limit and commission. A
credential is only valid when issued by the right issuer, **accepted** by the user, and
unexpired.

### How do rent payments fit in?
Monthly rent also settles **on-chain** (the tenant pushes a payment from their
self-custody wallet). This makes "did they pay?" objectively verifiable on the ledger,
which shrinks the human quorum to genuine disputes.

### Why XRP and not a stablecoin?
The MVP uses XRP (live since 2017, simplest path). XRP is volatile vs a fiat-denominated
rent, mitigated by over-collateralization. The structural fix is a stablecoin escrow in
a later phase — **MXNB** (Bitso's regulated MXN stablecoin coming to XRPL) is the lead
candidate.

---

## Status, legal & usage

### Can I use this in production?
**No.** It's an experimental **testnet proof of concept**, unaudited. Not for mainnet or
real funds.

### Is this financial or legal advice? Are you a regulated entity?
No and no. This is reference software, not advice, and the project is not a financial
institution. Issuing guarantees is regulated activity; an operator who deploys this is
responsible for their own licensing and compliance. See [`DISCLAIMER.md`](../DISCLAIMER.md).

### What's the tech stack?
TypeScript monorepo, `xrpl.js` 5, Vitest, Postgres (with an in-memory adapter for
tests). The core is transport-agnostic; API/SDK/mobile are planned channels on top.

### How do I run it?
See the [README quickstart](../README.md#quickstart): `npm install`, then `npm test`
(unit tests are network-free; integration tests hit XRPL testnet; persistence tests use
a local Postgres via `npm run db:up`).

### What's the roadmap?
Core lifecycle (escrow + credentials + reconciliation) is built and tested on testnet.
Next: end-to-end demo, then the product layer (REST API, SDKs, white-label mobile app,
on-chain rent), and eventually migration to XLS-100. See the decision log
([`decisions.md`](./decisions.md)).

### How can I contribute?
See [`CONTRIBUTING.md`](../CONTRIBUTING.md). Found an XRPL pitfall we missed? Add it to
[`xrpl-gotchas.md`](./xrpl-gotchas.md) via a PR.
