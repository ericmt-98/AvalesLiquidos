# Avales Líquidos

**Open-source reference implementation for liquid rent guarantees on the XRP Ledger.**

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Status](https://img.shields.io/badge/status-experimental%20·%20testnet-orange)
![XRPL](https://img.shields.io/badge/XRPL-xrpl.js%205.0-2c7be5)
![Tests](https://img.shields.io/badge/tests-69%20passing-brightgreen)

> ⚠️ **Experimental — testnet proof of concept. Not for mainnet or real funds.**
> This project publishes *rails*; it does not operate a pool or custody funds. See [`DISCLAIMER.md`](./DISCLAIMER.md).

---

## What this is

A **liquid rent guarantee** (*aval líquido*) replaces the traditional Mexican rental
surety/bond (*póliza jurídica / fiador*): a capital pool locks an XRPL escrow in favor
of a landlord, guaranteeing a tenant's obligation in exchange for a commission — so the
tenant **doesn't immobilize their own capital**. Reputation is managed on-chain with
XLS-70 Credentials, and rent payments settle on-chain too.

This repository is the **reference implementation and standard** for building that on
XRPL. Nobody in Mexico is doing this openly yet; the goal is to be the example.

### Honest positioning
- **We publish the rails — we don't operate a pool or custody funds.** Whoever deploys
  this operates the pool and **assumes their own regulatory responsibility**
  (guarantee issuance is regulated activity). See [`DISCLAIMER.md`](./DISCLAIMER.md).
- **User wallets are self-custody.** The pool's capital and the execution decision
  (fulfillment under a human quorum + KMS) belong to the operator.
- Decentralizing the default decision is the migration target once XLS-100 (Smart
  Escrows) ships.

## How it works

```
Tenant ──commission──▶ [ Pool (operator capital) ] ──locks──▶ XRPL Escrow
                                                                 │
                       default  → EscrowFinish ─────────────────▶ Landlord (direct)
                       on time  → EscrowCancel (after CancelAfter) ─▶ back to pool
```

- **Escrow** uses `Condition + CancelAfter` (no `FinishAfter`) so a default is
  executable at any time, with a 30-day cancel margin — see [why](./docs/xrpl-gotchas.md).
- **Execution** requires a human **3-of-5 quorum**; the fulfillment is decrypted from
  KMS only after approval, then `EscrowFinish` pays the landlord directly on-chain.
- **Reputation**: 4 tiers (`bronze → platinum`) as XLS-70 Credentials gate limits.

## Architecture

A **transport-agnostic core** (`packages/core`) holds all the logic; channels (API, SDK,
mobile app) are skin on top. Full design in
[`arquitectura_producto.md`](./arquitectura_producto.md). The detailed XRPL engine spec
is maintained as an internal document; its practical lessons are distilled publicly in
[XRPL gotchas](./docs/xrpl-gotchas.md).

## What's built

| Phase | Module | Status |
|-------|--------|--------|
| A | Monorepo, config, XRPL client, Ripple-Epoch time | ✅ |
| B | Crypto-conditions, KMS/Quorum/KYC ports, multisig Pool Master | ✅ |
| C | Postgres + in-memory persistence (shared contract) | ✅ |
| D | XLS-70 reputation credentials | ✅ |
| E | Aval lifecycle — create / execute default / complete | ✅ |
| F | State reconciliation — listener + periodic sweep | ✅ |
| G | Beneficiary panel + end-to-end demo | ⬜ planned |
| H | Coverage + anti-regression checklist | ⬜ planned |

**69 tests** pass (unit + integration against real XRPL testnet and Postgres).
Roadmap and product layer (API, SDK, mobile, on-chain rent) in
[`plan_implementacion_mvp.md`](./plan_implementacion_mvp.md).

## Quickstart

Requires Node.js ≥ 20. The integration tests connect to XRPL **testnet**.

```bash
git clone https://github.com/ericmt-98/AvalesLiquidos.git
cd AvalesLiquidos
npm install

# unit tests only (no network):
npm test --workspace @avales-liquidos/core -- test/unit

# full suite (unit + testnet integration):
npm test

# persistence integration tests need a local Postgres:
npm run db:up          # docker compose up -d postgres
cp packages/core/.env.example packages/core/.env   # sets DB_URL
npm test
npm run db:down
```

## Repository layout

```
packages/core/        # the engine (config, xrpl, credentials, avales, db, reconciliation)
docs/                 # documentation map, decision log (ADRs), XRPL gotchas
arquitectura_producto.md      # product architecture (source of truth)
plan_implementacion_mvp.md     # implementation plan
DISCLAIMER.md         # legal / regulatory notice
```

## Documentation

- [FAQ](./docs/faq.md) — from "what is an escrow?" to trust, custody, and the roadmap
- [XRPL escrow & credential gotchas](./docs/xrpl-gotchas.md) — common mistakes, with fixes
- [Decision log (ADRs)](./docs/decisions.md)
- [Documentation map & governance](./docs/README.md)
- [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

## License

[Apache-2.0](./LICENSE) © 2026 Eric Mota Tejeda. Not legal or financial advice; see
[`DISCLAIMER.md`](./DISCLAIMER.md).
