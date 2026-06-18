# Security Policy

This project handles cryptographic secrets (escrow fulfillments) and value-bearing
transactions. Security reports are taken seriously.

## Status

This is an **experimental, testnet proof of concept**. It is **not audited** and must
**not** be used on mainnet or with real funds (see [`DISCLAIMER.md`](./DISCLAIMER.md)).

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

- Use **GitHub's private vulnerability reporting**: the *Security* tab → *Report a
  vulnerability* (GitHub Security Advisories).
- Include: affected component, reproduction steps, impact, and any suggested fix.

We aim to acknowledge reports within a few days. Coordinated disclosure is appreciated:
please give us a reasonable window to fix before public disclosure.

## Out of scope

- Issues that require mainnet deployment with real funds (this is testnet-only).
- The regulatory/operational responsibilities of an operator who deploys this software —
  those are the operator's, by design (see `DISCLAIMER.md`).

## Handling secrets

If you contribute: never log, persist in cleartext, or commit fulfillments, seeds, or
KMS material. Test fixtures must use generated/throwaway keys only.
