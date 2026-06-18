# Registro de decisiones (ADR-log)

> Cada decisión consecuente del proyecto, fechada, con contexto → decisión → consecuencias. Es la **fuente de verdad de los porqués** (ver `docs/README.md` §1). Cuando una decisión crece o necesita debate público, se promueve a un ADR individual en `docs/decisions/NNNN-titulo.md`.

**Estado:** estable · **Actualizado:** 2026-06-18 · **Dueño:** equipo Avales Líquidos

Formato de cada entrada: **ADR-N — Título** · `fecha` · `estado`
**Contexto** / **Decisión** / **Consecuencias**.

---

## ADR-1 — El producto es el Aval Líquido (se descarta el depósito auto-colateralizado) · 2026-06-18 · aceptada

**Contexto.** Al explorar modelos no-custodios surgió la idea de que el inquilino bloquee sus propios fondos (depósito programable). Eso elimina al pool pero mata la propuesta de valor.
**Decisión.** El producto es el **Aval Líquido** del reporte v4: un pool respalda la obligación; el inquilino **paga una comisión y NO inmoviliza su capital**. El "depósito inteligente" queda descartado como producto.
**Consecuencias.** Toda la documentación se reencuadra sobre este modelo. No se ofrece depósito auto-colateralizado como default ni como perfil equivalente.

## ADR-2 — Posicionamiento: infraestructura open-source de referencia · 2026-06-18 · aceptada

**Contexto.** El reporte v4 está escrito como si nosotros fuéramos la fintech operadora. El objetivo real es ser "el ejemplo y la norma" en México, donde nadie lo hace ni enseña.
**Decisión.** Publicamos la **implementación de referencia open-source**; **no operamos el pool**. Quien lo despliegue (inmobiliaria/fintech) opera y **asume su propia carga regulatoria**.
**Consecuencias.** La "fintech custodial" del reporte describe un perfil de despliegue del *operador*, no a nosotros. Requiere `DISCLAIMER.md` prominente. La regulación no recae sobre el proyecto.

## ADR-3 — Self-custody de wallets de usuario; el operador custodia el fulfillment · 2026-06-18 · aceptada

**Contexto.** "No custodiamos" debe definirse con precisión para no engañar.
**Decisión.** Inquilino y arrendador hacen **self-custody** de sus llaves (wallet embebida passkey/smart). El **capital del pool y el fulfillment/quorum/KMS son del operador** (reporte §2.3). Nosotros-proyecto no custodiamos nada porque no operamos.
**Consecuencias.** La app no expone seed phrases. La reputación se ancla a la address del usuario (portátil). La descentralización de la decisión llega con XLS-100. No se vende como trustless.

## ADR-4 — Asentamiento directo on-chain al arrendador · 2026-06-18 · aceptada · ⚠️ diverge del reporte §7.4

**Contexto.** El reporte §7.4 prefería off-ramp a pesos para arrendadores no-cripto, lo que mete un intermediario lento/frágil en la ruta crítica.
**Decisión.** Separar **gatillo** (quorum, custodial del operador) de **asentamiento** (`EscrowFinish` paga **directo a la wallet self-custody del arrendador**). Sin hop intermedio ni gestor de pagos. El off-ramp a fiat queda desacoplado y self-service.
**Consecuencias.** Diverge conscientemente del reporte §7.4 (marcado en `arquitectura_producto.md` §11). Refuerza la centralidad de MXNB (estabilidad al cobrar directo). Se elimina el rol `gestor_de_pagos`.

## ADR-5 — Pagos de renta on-chain · 2026-06-18 · aceptada · 🆕 no está en el reporte

**Contexto.** Si solo el escrow vive on-chain, el impago sigue siendo un juicio subjetivo del operador.
**Decisión.** La **renta mensual también va on-chain** (`Payment` push firmado por el inquilino, observado por la reconciliación del reporte §4).
**Consecuencias.** El impago se vuelve **verificable objetivamente on-chain** → encoge el quorum humano a solo disputas → reduce la dependencia de XLS-100. Sin débito automático (coherente con self-custody). Es extensión de producto, no del reporte (`arquitectura_producto.md` §11bis).

## ADR-6 — App móvil white-label · 2026-06-18 · aceptada

**Contexto.** Los usuarios prefieren app móvil; cada plataforma adoptante quiere su marca.
**Decisión.** **Una sola base Expo white-label**, rebrandeable por tenant en runtime vía `GET /v1/tenants/{id}/branding`. Sin recompilar por cliente.
**Consecuencias.** `apps/mobile` nace multi-tenant. Theming = datos, no código. Endpoint de branding nuevo; sin otros cambios en core/API.

## ADR-7 — Segundo SDK oficial: PHP · 2026-06-18 · aceptada

**Contexto.** Con OpenAPI cualquiera autogenera un SDK; el oficial es señal de DX y se invierte donde más fricción hay.
**Decisión.** TypeScript (1º, cubre Node+web+app) → **PHP** (2º oficial, stack dominante de portales inmobiliarios LatAm) → Python por demanda.
**Consecuencias.** PHP añade adopción, no capacidad. Si el primer cliente real es Node, se pospone sin costo arquitectónico.

## ADR-8 — KYC como puerto enchufable · 2026-06-18 · aceptada

**Contexto.** El proveedor de KYC (INE/CURP) no está decidido y no debe bloquear.
**Decisión.** Modelar KYC como **puerto/interfaz** (`KycProvider`) con `ManualKycProvider` (stub) en el MVP, igual que `KmsProvider`/`QuorumProvider`.
**Consecuencias.** Se integra el proveedor real después sin tocar core ni onboarding. Las credentials de reputación solo se emiten tras `status === 'approved'`.

## ADR-9 — Licencia Apache-2.0 · 2026-06-18 · aceptada

**Contexto.** Proyecto de infraestructura que quiere ser estándar y ser adoptado por empresas.
**Decisión.** **Apache-2.0** (concesión expresa de patentes, amigable para empresas, estándar del ecosistema XRPL).
**Consecuencias.** `LICENSE` Apache-2.0 en raíz; cabeceras de licencia en archivos fuente al iniciar el código.

## ADR-10 — Idioma de la documentación · 2026-06-18 · aceptada

**Contexto.** Mercado local en español; comunidad XRPL global en inglés.
**Decisión.** **Inglés** para técnico/global (README, ARCHITECTURE, API, CONTRIBUTING, ADRs públicos); **español** para adopción/mercado (guías de integración/operador, DISCLAIMER). Detalle en `docs/README.md` §4.
**Consecuencias.** Docs de diseño internos actuales siguen en español (lengua de trabajo); se traducen/resumen al publicar.

## ADR-11 — Arquitectura API-first, monorepo, un solo core · 2026-06-18 · aceptada

**Contexto.** Hay que servir a usuarios (app móvil) y a clientes (integración) sin duplicar lógica.
**Decisión.** **Core agnóstico de transporte** + **API pública única** (OpenAPI) + canales (app, portal, panel) como piel. Monorepo `packages/{core,api,sdk-ts}` + `apps/{mobile,panel}`. La app móvil consume la misma API pública (dogfooding).
**Consecuencias.** Detalle en `arquitectura_producto.md`. El plan construye `packages/core` (fases A–H) y añade el resto (I/J/K/R).

---

> Decisiones aún abiertas: proveedor concreto de KYC (INE/CURP) y de off-ramp MXN; stablecoin de Fase 2 (MXNB vs RLUSD, checklist reporte §7.3). Ver `arquitectura_producto.md` §9bis.
