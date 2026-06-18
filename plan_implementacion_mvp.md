# Plan de Implementación — MVP Técnico (PoC Testnet)
## Sistema de Avales Líquidos sobre XRPL

**Fuente de verdad:** `reporte_v4_fuente_de_verdad.md` (v4.1, 11 Jun 2026 — **documento interno, no publicado**; las citas `§X` apuntan a él)
**Ejecutor previsto:** agente Claude Sonnet, tarea por tarea
**Alcance de este plan:** todo sobre **testnet**. Las fases **A–H** son el **MVP técnico de Fase 1** del reporte (§6); las fases **I/J/K/R** son la **capa de producto** definida en `arquitectura_producto.md` (API, SDK, app white-label, renta on-chain) — extensiones encima del motor del reporte (la renta on-chain §11bis no está en el reporte; es decisión de producto del 18 Jun). NO cubre Fase 0 (legal/underwriting), NI Fase 2 (MPT/stablecoin/APPT), NI Fase 3 (XLS-100/mainnet con capital).
**Fecha:** 18 de Junio, 2026

> **Posicionamiento (ver `arquitectura_producto.md` §0):** el producto es el **Aval Líquido** (pool respalda; el inquilino paga comisión, no inmoviliza capital). Publicamos la **implementación de referencia open-source**; **no operamos el pool** — el adoptante lo opera y asume su regulación. **Self-custody aplica a las wallets de los usuarios** (inquilino/arrendador); el **pool y el fulfillment/quorum (B3, E2, KMS) son del operador** (reporte §2.3), se descentralizan con XLS-100.

---

## 0. Cómo usar este plan (instrucciones para el agente Sonnet)

1. **La fuente de verdad es `reporte_v4_fuente_de_verdad.md`.** Ante cualquier duda de semántica XRPL, citar y seguir el reporte. Las referencias `§X` apuntan a sus secciones.
2. **Ejecutar las tareas en orden.** Cada tarea tiene `Depende de`, `Entregable` y `Criterio de aceptación (DoD)`. No avanzar a una tarea sin cumplir el DoD de sus dependencias.
3. **No reintroducir los bugs corregidos en v4.** Antes de escribir cualquier transacción, releer el "REGISTRO DE CAMBIOS vs v3.0" del reporte. Los 🔴 rompían producción.
4. **Reglas no negociables (extraídas del reporte):**
   - Escrow = `Condition + CancelAfter`, **sin** `FinishAfter` (§2.2, cambio #6).
   - `EscrowCancel` valida contra `cancel_after`, **nunca** contra el vencimiento (§3.6, cambio #4).
   - Timestamps en **Ripple Epoch** vía `isoTimeToRippleTime`, nunca UNIX crudo (§2.2).
   - El **fulfillment jamás** va a logs ni a BD en claro; solo cifrado en KMS (§2.3, §3.3).
   - Verificación de credencial **completa**: emisor + `lsfAccepted` + `Expiration` + tier (§3.4, cambio #7).
   - `subscribe` **antes** de `client.on('transaction')` (§4, cambio #15).
   - Usar constantes nombradas de xrpl.js, nunca literales de flags (§5).
   - Master key deshabilitada → **todo** se firma multisig 3-de-5 (§3.1, cambio #5).
5. **Verificar entorno antes de codear:** `xrpl@5.0.0` tiene breaking changes vs 4.x (cambio #17). Revisar su changelog antes del primer commit que toque la librería.
6. **Confirmar con el usuario antes de:** cualquier operación contra **mainnet**, mover fondos reales, o tocar configuración de KMS de producción. El PoC es **testnet** (`wss://s.altnet.rippletest.net:51233`).

---

## 1. Stack y decisiones técnicas (fijadas por el reporte)

| Decisión | Valor | Origen |
|----------|-------|--------|
| Librería XRPL | `xrpl@5.0.0` | §3, cambio #17 |
| Runtime | Node.js LTS + TypeScript | recomendado para tipado de tx |
| Red del PoC | Testnet `wss://s.altnet.rippletest.net:51233` | §3 |
| BD operativa | PostgreSQL | §1.1, §2.1 |
| Secretos / fulfillment | AWS KMS (backup HashiCorp Vault) — **mock local en PoC** | §2.3 |
| Tests | Jest/Vitest, objetivo **>80% coverage** | §6 entregables PoC |
| Gobernanza | Multifirma on-chain 3-de-5 + quorum humano 3-de-5 | §2.3 |

> **Nota de PoC:** KMS y el workflow de quorum se implementan tras una **interfaz** (`KmsProvider`, `QuorumProvider`) con una implementación *mock/local* para testnet. La implementación real (AWS KMS + Vault + workflow firmado) es trabajo de Fase 1 productiva, no del PoC. Mantener la interfaz estable para no reescribir los flujos.

---

## 2. Estructura del repositorio (objetivo)

> El monorepo completo está en `arquitectura_producto.md` §7. Las fases A–H de este plan construyen **`packages/core`** (el motor); las fases I/J/K/R añaden los paquetes hermanos (`packages/api`, `packages/sdk-ts`, `apps/mobile`, `openapi/`). El árbol de abajo es el contenido de **`packages/core/src/`**.

```
avales-liquidos/                      # monorepo (ver arquitectura §7)
└─ packages/core/                     # ← fases A–H de este plan
   ├─ package.json / tsconfig.json
   ├─ .env.example                    # XRPL_WSS, DB_URL, KMS_MODE=mock, etc.
   ├─ src/
   │  ├─ config/                      # carga de entorno, constantes (tiers, márgenes)
   │  ├─ xrpl/
   │  │  ├─ client.ts                 # conexión, autofill, helpers
   │  │  ├─ multisig.ts               # submitMultisigned (§3.1)
   │  │  ├─ cryptocondition.ts        # generateCryptoCondition (§3.2)
   │  │  └─ poolMaster.ts             # setupPoolMaster (§3.1)
   │  ├─ credentials/
   │  │  ├─ tiers.ts                  # enum + hex CredentialType (§2.4)
   │  │  ├─ issue.ts                  # Create / Accept / Delete (§3.7)
   │  │  └─ verify.ts                 # getValidTier (§3.4)
   │  ├─ avales/
   │  │  ├─ create.ts                 # createAval (§3.3)
   │  │  ├─ executeDefault.ts         # EscrowFinish (§3.5)
   │  │  └─ complete.ts               # markAsCompleted / EscrowCancel (§3.6)
   │  ├─ reconciliation/
   │  │  ├─ listener.ts               # subscribe + on('transaction') (§4)
   │  │  └─ reconcile.ts              # reconcileState horario (§4)
   │  ├─ providers/
   │  │  ├─ kms.ts                    # interfaz KmsProvider + mock
   │  │  ├─ quorum.ts                 # interfaz QuorumProvider + mock
   │  │  └─ kyc.ts                    # interfaz KycProvider + ManualKycProvider (B2b)
   │  └─ db/
   │     ├─ schema.sql                # tabla avales, credenciales, quorum_records
   │     └─ repository.ts             # acceso tipado
   ├─ test/                           # unit + integración testnet
   └─ scripts/                        # demo end-to-end del PoC (§G2)
```
> El **panel** beneficiario es `apps/panel/` (arquitectura §7), no parte de `core`. La tarea G1 lo construye ahí.

---

## 3. Fases del plan (tareas en orden de dependencia)

### FASE A — Cimientos del proyecto

**A1. Bootstrap del repo**
- Depende de: —
- Entregable: `package.json`, `tsconfig.json`, linter, scripts de test, `.env.example`, instalación de `xrpl@5.0.0`.
- DoD: `npm test` corre (aunque sea con 0 tests), TypeScript compila, `.env.example` lista todas las variables.

**A2. Capa de configuración y constantes**
- Depende de: A1
- Entregable: `src/config` con: WSS de testnet, parámetros de tiers (límite de monto y comisión por tier), margen de cancelación (**30 días**, §2.2), quorum (3-de-5).
- DoD: constantes centralizadas, sin números mágicos dispersos.

**A3. Cliente XRPL + helpers de tiempo**
- Depende de: A1
- Entregable: `src/xrpl/client.ts` (conexión/reconexión testnet) y helper de `isoTimeToRippleTime`.
- DoD: test que conecta a testnet y obtiene `server_info`; test unitario que confirma `rippleTime = unixTime − 946684800` (§2.2).

---

### FASE B — Gobernanza y primitivas criptográficas

**B1. Crypto-condition PREIMAGE-SHA-256**
- Depende de: A1
- Entregable: `src/xrpl/cryptocondition.ts` — `generateCryptoCondition()` exacto al §3.2 (sufijo `810120`, condition `A0258020…`, fulfillment `A0228020…`).
- DoD: test que genera condition/fulfillment, verifica longitudes (condition 32B hash, preimage 32B) y que el fulfillment **valida** contra la condition. **No** loguear el fulfillment (cambios #13, #14).

**B2. Interfaces KmsProvider y QuorumProvider (+ mocks)**
- Depende de: A1
- Entregable: `src/providers/kms.ts` (`encryptAndStore`, `decrypt(ref, token)`) y `src/providers/quorum.ts` (`requireApproval(avalId, action) → {granted, token, recordId}`). Mock local cifrado para PoC.
- DoD: el fulfillment se guarda solo como **referencia** (`fulfillment_ref`); el `decrypt` exige un `token` de quorum válido o falla. Tests de ambos caminos (§2.3, §3.5).

**B2b. Puerto KYC (enchufable después)**
- Depende de: A1
- Entregable: `src/providers/kyc.ts` — interfaz `KycProvider` (`startVerification`, `getStatus → pending|approved|rejected`) + `ManualKycProvider` (stub/sandbox). (`arquitectura_producto.md` §12)
- DoD: el sistema corre end-to-end con el stub; las credentials de reputación (D3) solo se emiten si `status === 'approved'`; enchufar un proveedor real no toca el core ni el onboarding.

**B3. Setup del Pool Master (multifirma)**
- Depende de: A3, A2
- Entregable: `src/xrpl/poolMaster.ts` — `setupPoolMaster` en el **orden obligatorio** (fondear → `SignerListSet` 3-de-5 → `AccountSet asfDisableMaster`) y `src/xrpl/multisig.ts` — `submitMultisigned` con `autofill(tx, signers.length)` (§3.1).
- DoD: test de integración en testnet que crea la cuenta, fija la signer list, deshabilita master key y luego ejecuta **una tx multisig** con éxito. Verificar que firmar con master key tras deshabilitarla **falla** (no reintroducir `tefMASTER_DISABLED`, cambio #5).

---

### FASE C — Persistencia

**C1. Esquema de BD**
- Depende de: A1
- Entregable: `src/db/schema.sql` con tabla `avales` (campos del §3.3: `id, escrow_owner, escrow_sequence, user_address, beneficiary_address, amount_xrp, vencimiento, cancel_after, condition, fulfillment_ref, contract_hash, estado, timestamps`), tabla de `quorum_records` y secuencia para `DestinationTag` (uint32, sin colisiones).
- DoD: migración aplicable; `estado ∈ {activo, cumplido, ejecutado, expirado}`; `nextDestinationTag()` secuencial y único.

**C2. Repositorio tipado**
- Depende de: C1
- Entregable: `src/db/repository.ts` con `avales.create/findOne/update/find` y `nextDestinationTag()`.
- DoD: tests CRUD contra una BD de test.

---

### FASE D — Credenciales (reputación, XLS-70)

**D1. Tiers y CredentialType en hex**
- Depende de: A1
- Entregable: `src/credentials/tiers.ts` — enum `BRONZE/SILVER/GOLD/PLATINUM` y codificación hex correcta. Validar contra el reporte: `REPUTACION_SILVER = 52455055544143494F4E5F53494C564552` (§2.4, cambio #3 — **sin `_` literal mal codificado**).
- DoD: test que codifica/decodifica los 4 tiers y compara `SILVER` con el hex exacto del reporte; longitud ≤ 64 bytes.

**D2. Verificación completa de credencial**
- Depende de: A3, D1
- Entregable: `src/credentials/verify.ts` — `getValidTier(client, poolAddress, userAddress)` idéntico al §3.4: chequea emisor, `lsfAccepted (0x00010000)`, `Expiration` y patrón de tier; devuelve tier o `null`.
- DoD: tests con credencial (a) de otro emisor → null, (b) sin aceptar → null, (c) expirada → null, (d) válida → tier (cambio #7).

**D3. Ciclo de vida de credenciales**
- Depende de: B3, D1, B2b (la emisión exige KYC `approved`)
- Entregable: `src/credentials/issue.ts` — `CredentialCreate` (issuer) → `CredentialAccept` (usuario) → `CredentialDelete` + re-emisión para cambiar tier; helpers `upgradeReputation` / `downgradeReputation` (§3.7).
- DoD: test testnet del ciclo completo; confirmar que tras `Delete` y antes de `Accept` de la nueva, `getValidTier` devuelve `null` (usuario en tránsito no puede abrir avales). **Sin Batch** — 3 tx separadas (cambio #12).

---

### FASE E — Ciclo de vida del aval (núcleo)

**E1. Crear aval**
- Depende de: B1, B2, B3, C2, D2
- Entregable: `src/avales/create.ts` — `createAval` exacto al §3.3: verifica tier + límites, genera crypto-condition, cifra fulfillment a KMS, calcula `CancelAfter = (durationDays + 30) días`, arma `EscrowCreate` (`Condition + CancelAfter`, `DestinationTag`, `Memo` con `aval_contract` + hash), envía **multisig**, persiste estado.
- DoD: test testnet que crea un aval real y verifica el escrow on-chain (`ledger_entry`); confirma que **no** hay `FinishAfter` y que el Memo contiene el hash. El fulfillment no aparece en BD ni logs (§2.2, §3.3).

**E2. Ejecutar incumplimiento (EscrowFinish)**
- Depende de: E1
- Entregable: `src/avales/executeDefault.ts` — `executeDefault` del §3.5: exige quorum, descifra fulfillment **solo tras quorum**, envía `EscrowFinish` (+`Fulfillment`), actualiza estado a `ejecutado`, guarda `quorum_record`, baja reputación.
- DoD: test testnet — aval creado → finish → beneficiario recibe XRP; escrow desaparece del ledger; `EscrowFinish` válido **en cualquier momento** antes de `CancelAfter` (no espera ventana, cambio #6). Presupuestar fee extra del fulfillment (§3.2).

**E3. Cierre por cumplimiento (EscrowCancel)**
- Depende de: E1
- Entregable: `src/avales/complete.ts` — `markAsCompleted` del §3.6: valida `nowRipple ≥ cancel_after` (**no** vencimiento), envía `EscrowCancel`, estado `cumplido`, sube reputación.
- DoD: test que (a) **rechaza** cancel antes de `cancel_after` con error claro, (b) permite cancel después → fondos vuelven al pool (cambio #4). No reintroducir validación contra `finish_after`.

---

### FASE F — Reconciliación de estado

**F1. Listener on-chain**
- Depende de: C2, E1
- Entregable: `src/reconciliation/listener.ts` — `subscribe` a la cuenta Pool Master **antes** del `client.on('transaction')`; al ver `EscrowFinish`/`EscrowCancel`, sincroniza el aval por `(Owner, OfferSequence)` (§4).
- DoD: test que confirma que sin `subscribe` el listener no dispara, y que con él sincroniza el estado correcto (cambio #15).

**F2. Reconciliación periódica**
- Depende de: F1
- Entregable: `src/reconciliation/reconcile.ts` — barrido horario de avales `activo`: `ledger_entry` del escrow; si ya no existe, resolver desenlace desde `account_tx` (§4).
- DoD: test de la red de seguridad — escrow finalizado fuera del websocket queda reconciliado al correr el barrido. Respetar la asimetría de evidencia (§2.1): el *motivo* lo da BD + quorum, no el tipo de tx.

---

### FASE G — Panel y demo

**G1. Panel beneficiario (read-only)**
- Depende de: C2, F1
- Entregable: `apps/panel/` — vista de avales por beneficiario con estado, monto, vencimiento, `cancel_after`, links a tx on-chain.
- DoD: lista avales desde la BD y enlaza a un explorador de testnet. Read-only (no expone fulfillment ni controles de quorum).

**G2. Script de demo end-to-end (entregable PoC)**
- Depende de: E2, E3, D3, F2
- Entregable: `scripts/demo.ts` que ejecuta los dos caminos completos exigidos en §6:
  1. crear → **finish** (incumplimiento) → beneficiario cobra → reputación baja.
  2. crear → **cancel** (cumplimiento) → fondos al pool → reputación sube.
  - más: credencial emitida/aceptada/rotada, y sync BD↔ledger demostrado.
- DoD: el script corre de punta a punta en testnet sin intervención manual y deja log auditable de cada tx hash.

---

### FASE H — Calidad y cierre del PoC

**H1. Cobertura y suite de tests**
- Depende de: todas las anteriores
- Entregable: suite unit + integración con **>80% coverage** (§6).
- DoD: reporte de cobertura ≥ 80%; CI verde.

**H2. Checklist anti-regresión v3.0**
- Depende de: H1
- Entregable: documento corto `CHECKLIST.md` mapeando cada 🔴/🟡 del registro de cambios del reporte a el/los test que lo blindan.
- DoD: cada hallazgo crítico (🔴 #1–#6) tiene al menos un test que fallaría si se reintrodujera el bug.

**H3. README de operación del PoC**
- Depende de: G2
- Entregable: cómo levantar BD, configurar `.env`, fondear cuentas testnet y correr la demo.
- DoD: un tercero reproduce la demo siguiendo solo el README.

---

### FASE I — Contrato + API pública (capa de integración)

> Ver `arquitectura_producto.md` §4. Convierte el core en un producto integrable. Depende de E–F (el ciclo de vida del aval debe existir antes de exponerlo).

**I1. Contrato OpenAPI**
- Depende de: E1, E2, E3
- Entregable: `openapi/openapi.yaml` (3.1) con recursos `users`, `reputation`, `quotes`, `beneficiaries`, `guarantees`, `claim`, `tenants/{id}/branding`, webhooks. Versionado `/v1`.
- DoD: el spec valida; sirve un mock server; cada endpoint mapea a una función del core. `POST /guarantees` exige `beneficiary_id` (el `Destination` del escrow es inmutable, `arquitectura_producto.md` §11).

**I1b. Beneficiario y asentamiento directo on-chain**
- Depende de: I1, C2
- Entregable: recurso `beneficiaries` con la **address self-custody del arrendador** (su propia wallet, §6); esa address se usa **tal cual** como `Destination` del `EscrowCreate`. Sin hop custodial intermedio ni gestor de pagos (`arquitectura_producto.md` §11).
- DoD: crear un aval sin beneficiario resuelto **falla**; el `Destination` del escrow es la wallet del arrendador; `EscrowFinish` deposita **directo** ahí en una sola tx (sin paso intermedio). Off-ramp a fiat queda fuera de la ruta crítica.

**I2. Capa REST + multi-tenancy + idempotencia**
- Depende de: I1, C2
- Entregable: `packages/api` — rutas sobre el core, auth multi-tenant (API key por tenant), `Idempotency-Key` en POST, `tenant_id` en todo dato.
- DoD: tests de aislamiento entre tenants; reintento con misma Idempotency-Key no duplica avales.

**I3. Webhooks firmados**
- Depende de: I2, F1
- Entregable: emisión de `guarantee.created/funded/claim_opened/executed/completed`, `reputation.updated`, firmados HMAC, con `event_id` y reintentos.
- DoD: test que la reconciliación (§4) dispara el webhook correcto y que la firma verifica.

### FASE J — SDK + Integration kit

**J1. SDK TypeScript generado**
- Depende de: I1
- Entregable: `packages/sdk-ts` generado del `openapi.yaml`.
- DoD: el SDK crea un aval contra el sandbox (testnet) en un test e2e.

**J2. Integration kit**
- Depende de: J1, I3
- Entregable: `integration-kit/` con `quickstart.md` ("primer aval en 30 min"), colección Bruno, verificador de firma de webhook, ejemplos.
- DoD: un tercero crea un aval en sandbox siguiendo solo el quickstart.

### FASE R — Pagos de renta on-chain (`arquitectura_producto.md` §11bis)

> El flujo completo en el ledger, no solo el aval. Vuelve el impago verificable on-chain.

**R1. Registro de contratos (leases)**
- Depende de: C2, D2
- Entregable: recurso/tabla `leases` (partes, monto/mes, periodicidad, token, hash del contrato en Memo) + API `POST /v1/leases`, `GET /v1/leases/{id}/ledger`.
- DoD: contrato registrado, vinculado a inquilino/arrendador y a su aval.

**R2. Pago mensual push (firmado por el inquilino)**
- Depende de: R1, K1 (wallet self-custody)
- Entregable: construcción del `Payment` mensual etiquetado (DestinationTag/Memo con lease+período) que **firma la wallet del inquilino**; `POST /v1/leases/{id}/payments`.
- DoD: pago on-chain observable en testnet, atribuible al período correcto. Sin débito automático (push desde la llave del usuario).

**R3. Detección de impago + enganche con el aval**
- Depende de: R2, F1
- Entregable: usar la reconciliación (§4) para verificar si el `Payment` del período ocurrió antes de límite+gracia; emitir `rent.paid`/`rent.due`/`rent.missed`; `rent.missed` encadena el caso de cobertura del aval (E2) y `rent.paid` sube reputación.
- DoD: período sin pago tras gracia marca `missed` y abre el claim; pago puntual actualiza reputación. La condición de impago es **verificable on-chain** (encoge el quorum a disputas).

---

### FASE K — App móvil inquilino

**K1. App Expo white-label con wallet self-custody**
- Depende de: J1
- Entregable: `apps/mobile` (Expo/React Native) **white-label** con **wallet embebida self-custody** (passkey/smart wallet — `arquitectura_producto.md` §6): la llave nunca sale del dispositivo. El inquilino firma **sus** transacciones de usuario (`CredentialAccept` de su reputación y el `Payment` de renta); el escrow del aval lo crea el operador del pool, no el usuario. Consume `sdk-ts`; resuelve tenant y aplica branding desde `GET /v1/tenants/{id}/branding` en runtime (§10); flujos de inquilino: onboarding+wallet+KYC → aceptar credencial → solicitar aval (lo emite el operador) → pagar renta → ver estado y reputación.
- DoD: un solo binario sirve a ≥2 tenants con marcas distintas sin recompilar; la wallet firma una tx real en testnet sin exponer la llave; flujo completo funcional contra sandbox (dogfooding).

---

## 4. Fuera de alcance de este plan (no implementar en el PoC)

Por decisión explícita del reporte, **no** se construye aquí:
- **CAA** (certificado MPT) — eliminado del MVP (§1.1, cambio #8).
- **APPT** (token de participación) — Fase 2, riesgo de *security* (§1.1, cambio #9).
- **Escrow de stablecoin MPT / MXNB** — Fase 2, condicionado a checklist §7.3.
- **PermissionedDomains, DepositPreauth como gating** — evaluación, no MVP.
- **Trabajo legal/underwriting de Fase 0** — no es código; es el GO/NO-GO previo (§6). El PoC técnico puede construirse en paralelo en testnet, pero **el piloto en mainnet con capital depende del GO de Fase 0**.

---

## 5. Orden de ejecución resumido (ruta crítica)

```
A1 → A2 → A3
        ├─ B1
        ├─ B2
        └─ B3 ─┐
A1 → C1 → C2 ──┤
A1 → D1 → D2   │
        └ D3 ←─┘ (D3 requiere B3)
   E1 (requiere B1,B2,B3,C2,D2)
   ├─ E2
   └─ E3
   F1 → F2
   G1 ; G2 (requiere E2,E3,D3,F2)
   H1 → H2 → H3
   ── capa de producto (arquitectura_producto.md) ──
   I1 (+I1b) → I2 → I3 (API: contrato/beneficiario → REST/tenancy → webhooks)
   J1 → J2             (SDK → integration kit)
   K1                  (app móvil white-label + wallet self-custody)
   R1 → R2 → R3        (renta on-chain; R2 requiere K1; R3 engancha con E2)
```
> `B2b` (puerto KYC) cuelga de A1 y habilita D3. El Pool Master + quorum + KMS (B3, E2) son del **operador** del pool (reporte §2.3): es custodia de la decisión a nivel operador, no del proyecto. Las wallets de usuario (inquilino/arrendador) son self-custody.

## 6. Definición de "PoC terminado" (criterio global)

Cumplido cuando, **en testnet y sin intervención manual**, el script de demo demuestra:
1. Pool Master multisig 3-de-5 con master key deshabilitada.
2. Aval creado con `Condition + CancelAfter` (sin `FinishAfter`), Memo con hash.
3. Camino incumplimiento: `EscrowFinish` con fulfillment liberado tras quorum.
4. Camino cumplimiento: `EscrowCancel` válido solo tras `cancel_after`.
5. Credencial emitida → aceptada → rotada, con verificación completa.
6. BD y ledger reconciliados (listener + barrido).
7. Cobertura > 80% y checklist anti-regresión verde.

> Recordatorio final del reporte: **re-verificar el estado de enmiendas on-chain antes de cada hito** (§ Estado de enmiendas). El estado de votación cambia.
