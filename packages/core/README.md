# @avales-liquidos/core

Core domain engine for **Avales Líquidos** — the transport-agnostic logic for liquid
rent guarantees on the XRP Ledger. No HTTP, no UI: just the engine that the API
(`packages/api`) and other channels build on (see `arquitectura_producto.md` §2).

> Status: **experimental — testnet PoC**. Not for mainnet / real funds. See `/DISCLAIMER.md`.

## What's here (Fase A — bootstrap)

| Module | Purpose |
|--------|---------|
| `src/config` | Runtime config + constants: tiers, cancel margin (30d, report §2.2), quorum 3-of-5 |
| `src/xrpl/time` | Ripple Epoch helpers (`rippleTime = unix − 946684800`, report §2.2) |
| `src/xrpl/client` | XRPL client factory + `withClient` lifecycle helper |

Upcoming (per `plan_implementacion_mvp.md`): cryptocondition, multisig pool master,
credentials, aval lifecycle, reconciliation.

## Commands

```bash
npm run typecheck     # tsc --noEmit
npm run test          # vitest (unit + testnet integration)
npm run test:unit     # unit only (no network)
npm run lint          # eslint
```

The integration tests connect to XRPL testnet (`wss://s.altnet.rippletest.net:51233`);
run `npm run test:unit` if offline.
