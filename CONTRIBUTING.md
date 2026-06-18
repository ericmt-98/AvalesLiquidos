# Contributing

Thanks for your interest in Avales Líquidos. This is an open-source **reference
implementation** for rent guarantees on the XRP Ledger; clarity and correctness matter
more than feature count.

## Ground rules

- Read [`docs/README.md`](./docs/README.md) (documentation map & source-of-truth rules)
  and [`docs/decisions.md`](./docs/decisions.md) (ADRs) before non-trivial changes — to
  avoid contradicting decisions already made.
- The engine spec is [`reporte_v4_fuente_de_verdad.md`](./reporte_v4_fuente_de_verdad.md);
  when in doubt about XRPL semantics, follow it and cite the section.
- Don't reintroduce fixed bugs — see [`docs/xrpl-gotchas.md`](./docs/xrpl-gotchas.md).
- **Never** log, persist in cleartext, or commit secrets (fulfillments, seeds, KMS data).

## Dev setup

Requires Node.js ≥ 20.

```bash
npm install
npm run typecheck --workspace @avales-liquidos/core
npm run lint --workspace @avales-liquidos/core
npm test --workspace @avales-liquidos/core -- test/unit   # fast, no network
```

Integration tests hit XRPL **testnet**; the persistence tests need Postgres:

```bash
npm run db:up    # docker compose up -d postgres
cp packages/core/.env.example packages/core/.env
npm test         # full suite
npm run db:down
```

## Tests

- `test/unit/**` — fast, no network. New logic needs unit coverage.
- `test/integration/**` — real testnet / Postgres. Use `describe.skipIf` to skip when a
  dependency (e.g. `DB_URL`) is absent, so CI without it stays green.
- A change that touches XRPL behavior should be proven on testnet.

## Conventions

- TypeScript strict; ESLint must pass. No `any` (use `unknown` + narrowing).
- Adapters behind ports (KMS, Quorum, KYC, repository) — keep interfaces stable.
- Conventional-commit style messages (`feat:`, `fix:`, `docs:`, `chore:`).
- Update docs in the **same PR** as behavior changes; generated artifacts aren't
  hand-edited.

## Pull requests

Keep them focused. Describe what changed and how you verified it (tests, testnet tx
hashes if relevant). By contributing you agree your work is licensed under
[Apache-2.0](./LICENSE).
