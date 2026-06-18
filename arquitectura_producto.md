# Arquitectura de Producto — Avales Líquidos
## Cómo el mismo motor sirve a usuarios (app móvil) y a clientes (integración)

**Complementa a:** `reporte_v4_fuente_de_verdad.md` (el motor) y `plan_implementacion_mvp.md` (las tareas).
**Fecha:** 18 de Junio, 2026
**Caso de referencia:** plataforma de rentas inmobiliarias en CDMX que ofrece "aval incluido" a sus inquilinos.

---

## 0. Posicionamiento (lee esto primero)

**El producto es el Aval Líquido** (modelo del reporte v4): un **pool respalda** la obligación del inquilino, que **paga una comisión en lugar de inmovilizar su propio capital**. Esa es la propuesta de valor central y el origen del proyecto. No la diluimos.

**Lo que publicamos es infraestructura open-source — la implementación de referencia y el estándar de cómo construir el aval líquido sobre XRPL.** Nadie en México lo está haciendo ni enseñando; el objetivo es ser el ejemplo y la norma.

Distinción clave para no confundir nada:

- **Nosotros (proyecto) no operamos el pool.** Publicamos los rieles; quien los despliegue (inmobiliaria, fintech) **opera el pool y asume su propia carga regulatoria**. La regulación no recae sobre el proyecto porque no somos el operador — no porque el producto sea otro.
- **Self-custody = wallets de los usuarios.** Inquilino y arrendador controlan sus llaves (§6); su reputación y sus pagos de renta salen de su propia llave. **El capital del pool es del operador.**
- **El fulfillment / decisión de ejecución lo tiene el operador del pool** (quorum + KMS, reporte §2.3), no el proyecto. Es custodial-con-controles a nivel operador, y eso es responsabilidad regulatoria del operador. Se descentraliza al migrar a XLS-100 (§6 del reporte).
- **Los pagos mensuales de renta también van on-chain** (§11bis), no solo el escrow de garantía. Refuerzan el aval (vuelven el impago verificable on-chain). Fiat/off-ramp es válido pero **opcional y responsabilidad del integrador**, fuera de la ruta crítica.

> El motor del reporte v4 (escrow `Condition+CancelAfter`, credentials, condition/fulfillment, reconciliación) es la base y se reutiliza tal cual. Este documento añade la **capa de producto** (API, SDK, app, renta on-chain) encima de ese motor.

---

## 1. Actores y qué reemplazamos

El producto sustituye a la **póliza jurídica de arrendamiento / fiador**. El inquilino paga una comisión en vez de inmovilizar un depósito o conseguir un fiador con propiedad; el pool garantiza al arrendador.

| Actor (reporte v4) | Rol inmobiliario | Canal principal | Necesidad |
|---|---|---|---|
| `user` | **Inquilino** | App móvil | Solicitar aval, KYC, pagar comisión y renta, ver estado, reputación |
| `beneficiario` | **Arrendador** | Web + notificaciones | Garantía; cobrar ante impago (directo a su wallet) |
| **cliente** (nuevo) | **Plataforma de rentas** | API + SDK + webhooks | Embeber el aval en su flujo, sin tocar cripto |
| operador | **El adoptante** (inmobiliaria/fintech que despliega) | interno | Opera el Pool, quorum, KMS, underwriting; **asume su regulación** |

> **Nosotros (proyecto) NO somos el operador.** Mantenemos la infraestructura open-source de referencia; no corremos ningún pool ni custodiamos fondos (§0). El "operador" de la tabla es quien despliega el sistema.

**Modelo B2B2C:** la plataforma trae al inquilino; el proyecto provee el motor open-source y (opcionalmente) la app white-label. El cliente nunca toca XRPL directamente; el inquilino tiene wallet self-custody pero sin gestionar seed phrases ni ver la complejidad del ledger (§6).

---

## 2. Principio rector: API-first, un solo core, múltiples canales

> El **core domain** (motor del reporte v4) es **agnóstico de transporte**: no sabe si lo invoca la app móvil, el portal de un cliente o un cron. Toda superficie pasa por la **misma API pública**. La app móvil propia consume esa misma API → es la prueba viviente (dogfooding) de que la API está completa.

```
┌──────────────────────────────────────────────────────────────────────┐
│ CANALES                                                                │
│  App móvil inquilino    Portal cliente (su sistema)   Panel arrendador │
│  (Expo/React Native)    (Laravel/Node/… vía SDK)      (web)            │
└─────────────┬───────────────────┬────────────────────────┬────────────┘
              │                   │   (mismo contrato /v1)  │
              ▼                   ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ API PÚBLICA (API-first)                                                │
│  • OpenAPI 3.1 versionada (/v1)        • Idempotency-Key en POST       │
│  • Auth multi-tenant (API key B2B / OAuth2 usuario)                    │
│  • Webhooks firmados HMAC              • Rate limit                     │
│  • Sandbox(testnet) ≡ Production(mainnet)                              │
└─────────────┬──────────────────────────────────────────────────────────┘
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CORE DOMAIN  (motor de avales — reporte v4, sin cambios de semántica)  │
│  avales(create/execute/complete) · credentials · escrow XRPL ·         │
│  quorum 3-de-5 · KMS · reconciliación BD↔ledger                        │
└──────────────────────────────────────────────────────────────────────┘
```

### Por qué esta forma satisface ambos casos
- **Usuario (app móvil):** UX nativa, sin fricción cripto. La app solo habla REST.
- **Cliente (integración):** la misma API + SDK + webhooks; integra en horas, no semanas.
- **Nosotros:** una sola lógica de negocio que mantener; los canales son piel.

---

## 3. Las tres cosas que gritan "casi listo para integrar"

1. **Contrato antes que código:** `openapi.yaml` versionado en el repo. Todo lo demás (SDKs, docs, mocks) se genera de ahí.
2. **Dogfooding visible:** la app móvil vive en el monorepo y consume el SDK público generado del OpenAPI. Si la app puede hacerlo, un cliente también.
3. **Integration kit listo:** sandbox = testnet, colección Bruno/Postman, guía *"tu primer aval en 30 minutos"*, ejemplos por lenguaje, webhooks con verificador de firma de ejemplo.

---

## 4. La API pública (contrato de integración)

Recursos `/v1` (nombres ilustrativos, a fijar en `openapi.yaml`):

| Método | Recurso | Para quién | Qué hace |
|---|---|---|---|
| `POST` | `/v1/tenants` *(interno)* | operador | Alta de plataforma cliente |
| `POST` | `/v1/users` | cliente / app | Alta de inquilino + arranque de KYC |
| `GET` | `/v1/users/{id}/reputation` | cliente / app | Tier vigente (mapea a `getValidTier`, §3.4) |
| `POST` | `/v1/quotes` | cliente / app | Cotizar comisión dado monto+plazo+tier (underwriting) |
| `POST` | `/v1/beneficiaries` | cliente | Alta de arrendador + address de cobro **on-chain** (no CLABE en la ruta crítica) — §11 |
| `POST` | `/v1/guarantees` | cliente / app | **Crear aval** (Idempotency-Key; requiere `beneficiary_id` resuelto → `Destination` directo) → dispara `createAval` (§3.3) |
| `GET` | `/v1/tenants/{id}/branding` | app (público) | Branding bundle white-label — §10 |
| `GET` | `/v1/guarantees/{id}` | cliente / app / arrendador | Estado del aval + links a tx on-chain |
| `POST` | `/v1/guarantees/{id}/claim` | cliente / arrendador | Reportar impago → entra al **quorum** (§3.5). No ejecuta solo |
| `GET` | `/v1/guarantees?beneficiary=` | arrendador | Listado (alimenta el panel, §G1 del plan) |

> `claim` **no** dispara `EscrowFinish` directamente: crea un caso que requiere quorum humano 3-de-5 con evidencia (§2.3). La API expone *intención*; el motor conserva el control de ejecución.

### Eventos / Webhooks (sincronización con el sistema del cliente)
Firmados con HMAC, con reintentos y `event_id` idempotente:
`guarantee.created` · `guarantee.funded` (escrow on-chain confirmado) · `guarantee.claim_opened` · `guarantee.executed` (EscrowFinish) · `guarantee.completed` (EscrowCancel) · `reputation.updated`.

Estos eventos son la traducción 1:1 de los estados del reporte (`activo/ejecutado/cumplido`) y de la reconciliación (§4) hacia el mundo del cliente.

---

## 5. Multi-tenancy

Cada plataforma cliente = **tenant** aislado:
- Su API key/secret, sus usuarios, sus avales, sus endpoints de webhook.
- Su configuración de producto **dentro de los límites del underwriting** (tiers, límite por tier, comisión, sobre-colateralización — §1.3, §2.4).
- Aislamiento de datos a nivel de fila (todo lleva `tenant_id`).

---

## 6. Identidad y wallets (self-custody de usuarios)

Self-custody aplica a las **llaves de los usuarios** (inquilino y arrendador). El **pool y la decisión de ejecución son del operador** (§0). Nosotros-proyecto no custodiamos nada porque no operamos.

- **Self-custody con UX de app:** el inquilino y el arrendador tienen **wallet embebida** (passkey / smart wallet) dentro de la app white-label. El usuario controla la llave; la experiencia se siente como una app normal, sin seed phrases a la vista. Su address es **suya**.
- **Reputación portátil:** las credentials (XLS-70) se anclan a la address del propio usuario → su reputación le pertenece y es portátil entre integradores. (la `userAddress` del §3.4 es del usuario, no del operador.)
- **El usuario firma sus propias transacciones de usuario:** el `Payment` de renta (§11bis) sale firmado por la wallet del inquilino. La app construye la tx; la llave nunca sale del dispositivo.
- **El escrow del aval lo crea y ejecuta el operador del pool:** `EscrowCreate` (capital del pool) y `EscrowFinish` (con el fulfillment custodiado por el operador vía quorum/KMS, reporte §2.3) son del operador, no del usuario. El `Destination` es la wallet self-custody del arrendador → cobra directo (§11).
- **Auth por canal:**
  - Clientes B2B (integradores/operadores) → API key + secret con scopes, por tenant.
  - Usuarios → autenticación + control de su wallet; **KYC** como puerto enchufable (§12), responsabilidad del integrador que lo necesite.

---

## 7. Estructura del repo (monorepo orientado a integración)

```
avales-liquidos/
├─ openapi/
│  └─ openapi.yaml              # ⟵ EL CONTRATO. Fuente de SDKs y docs
├─ packages/
│  ├─ core/                     # motor del reporte v4 (agnóstico de transporte)
│  │  └─ src/{xrpl,credentials,avales,reconciliation,providers,db}/  (plan §2)
│  ├─ api/                      # capa REST: auth multi-tenant, webhooks, idempotencia
│  │  └─ src/{routes,middleware,webhooks,tenancy}/
│  ├─ sdk-ts/                   # SDK TypeScript GENERADO del openapi.yaml
│  └─ sdk-php/                  # (Fase posterior — muchas inmobiliarias usan PHP)
├─ apps/
│  ├─ mobile/                   # app inquilino (Expo) — consume sdk-ts → dogfooding
│  └─ panel/                    # panel arrendador/operador (web, read-only)
├─ integration-kit/
│  ├─ quickstart.md             # "tu primer aval en 30 min" (contra sandbox/testnet)
│  ├─ avales.bruno/             # colección de requests lista para correr
│  ├─ webhook-verifier/         # ejemplo de verificación de firma HMAC
│  └─ examples/                 # snippets: crear aval, escuchar webhooks, claim
└─ scripts/demo.ts              # demo end-to-end (plan §G2)
```

Quien clona el repo encuentra, en este orden: **el contrato** (`openapi/`), **un SDK ya generado**, **una app real que lo usa**, y **un kit de integración que corre contra sandbox**. Ese recorrido es lo que comunica "casi listo para integrar".

---

## 8. Cómo se conecta con el plan MVP existente

El `plan_implementacion_mvp.md` construye el **core** (fases A–H). Esta arquitectura añade tres bloques que se apoyan en él:

- **Fase I — Contrato + API:** `openapi.yaml`, capa REST sobre el core, auth multi-tenant, idempotencia, webhooks. (Depende de fases E–F del plan: el ciclo de vida del aval debe existir antes de exponerlo.)
- **Fase J — SDK + Integration kit:** generar `sdk-ts`, quickstart, colección Bruno, verificador de webhooks, sandbox documentado.
- **Fase K — App móvil:** Expo consumiendo `sdk-ts`; flujos de inquilino (alta/KYC → cotizar → solicitar aval → ver estado/reputación). Prueba el dogfooding.

> Orden recomendado: terminar el core (A–H) → I → J → K. La app móvil al final **porque** valida que la API y el SDK están completos; construirla antes invertiría la dependencia.

---

## 9. Decisiones tomadas

1. **Distribución de la app móvil → WHITE-LABEL** (18 Jun 2026). Una sola base de código Expo, rebrandeable por tenant (logo, color, nombre, dominio) vía configuración remota; sin recompilar por cliente. Detalle en §10.
2. **Beneficiario del pago → arrendador directo** (18 Jun 2026, refinado). Ante impago ejecutado, `EscrowFinish` paga **directo a la wallet self-custody del arrendador**, sin hop intermedio ni gestor de pagos en la ruta crítica. Detalle en §11.

## 9bis. Decisiones aún abiertas

3. **Proveedor de KYC mexicano** (INE/CURP): el *proveedor* sigue sin decidir, pero la arquitectura ya lo contempla como **puerto enchufable** (§12) — se integra después sin reescribir flujos. El off-ramp MXN deja de ser bloqueante por la decisión de §11.
4. **Lenguaje del segundo SDK → resuelto: PHP** (§13).

---

## 10. App móvil white-label

Una sola app, muchas marcas. **No se recompila por cliente.**

- **Configuración por tenant servida en runtime:** la app arranca, detecta el tenant (deep link, dominio, o código de la plataforma) y pide a la API su *branding bundle*: `logo_url`, `color_primario`, `nombre_comercial`, textos legales, enlaces.
- **Endpoint nuevo:** `GET /v1/tenants/{id}/branding` (público, cacheable).
- **Un solo binario** en App Store / Play Store (o build interno distribuido por la plataforma); el theming es datos, no código.
- Implicación en el repo: `apps/mobile` ya nace multi-tenant (selector/resolución de tenant + theming dinámico), no hardcodea marca. Sin cambios en `core` ni en la API más allá del endpoint de branding.

> Más adelante, si una plataforma exige su propia ficha de tienda, el mismo código se reempaqueta con assets distintos — pero eso es build, no arquitectura.

---

## 11. Beneficiario y asentamiento on-chain (sin intermediarios en la ruta crítica)

**Principio (18 Jun 2026):** todo lo que pueda resolverse en la capa blockchain, se resuelve ahí. Cada intermediario añade pasos, latencia y puntos de fallo, así que se eliminan de la ruta crítica de ejecución.

**Separación clave — gatillo ≠ asentamiento:**
- El **gatillo** (decidir ejecutar el impago) sigue siendo custodial: quorum humano 3-de-5 con evidencia (§2.3 del reporte). No cambia.
- El **asentamiento** es **directo on-chain**: `EscrowFinish` (§3.5) paga **directo a la address del beneficiario** (`Destination` del escrow). **Sin hop custodial intermedio, sin gestor de pagos, sin off-ramp en medio.** Una sola transacción, atómica y auditable, es el pago.

**Modelo único de beneficiario: directo.**
- Al crear el aval, se usa la **address self-custody del arrendador** (§6) tal cual como `Destination` del `EscrowCreate` (§2.2). El arrendador controla esa llave; **el escrow paga directo a su wallet** — no hay cuenta puente ni address provisionada por un operador que reparta después.
- Se elimina el rol `gestor_de_pagos` de la ruta crítica: un intermediario que recibe y reparte es exactamente el paso lento/frágil que se quiere evitar.
- **El off-ramp a pesos queda desacoplado y self-service:** si el arrendador quiere convertir a fiat, lo hace por su cuenta (vía Bitso u otro), cuando quiera. **No bloquea ni forma parte de la ejecución del aval.** El asentamiento on-chain es la fuente de verdad y el pago; la conversión a pesos es un concern posterior y opcional del beneficiario.

**Honestidad sobre el límite:** los pesos no pueden existir on-chain; alguien eventualmente puentea a fiat. Lo que hacemos es **sacar ese puente de la ruta crítica** y volverlo opcional/self-service, no un paso intermediado por nosotros. Esto contradice conscientemente la preferencia de off-ramp del §7.4 del reporte, priorizando minimizar pasos y fallos.

**Sinergia con Fase 2 (MXNB):** pago directo on-chain a la address del arrendador es limpio en stablecoin (valor estable al cobrar). En el MVP en XRP, el arrendador queda expuesto a volatilidad en el instante del `EscrowFinish`; se mitiga con sobre-colateralización (§1.3 del reporte). Esto vuelve a MXNB **más** central, no menos.

**API:** recurso `beneficiaries` con la address de cobro on-chain (no CLABE en la ruta crítica). El `Destination` es **inmutable** tras `EscrowCreate`: la API exige `beneficiary_id` resuelto en `POST /v1/guarantees` y rechaza la creación sin él; cambiar de beneficiario exige cancelar y recrear el aval.

---

## 11bis. Pagos de renta on-chain (el flujo completo en el ledger)

No solo el escrow de garantía vive on-chain; **la renta mensual también**. Esto es lo que vuelve el sistema un estándar de extremo a extremo, no solo una garantía.

**Diseño:**
- La renta se denomina en un token: **XRP** en MVP/testnet; **MXNB/RLUSD** como objetivo (estabilidad, §7 del reporte). El contrato de arrendamiento se registra como acuerdo (hash en Memo, igual que el aval).
- **Cada mes el inquilino envía un `Payment`** al arrendador, etiquetado (`DestinationTag`/Memo) con el ID de contrato y el período. XRPL no tiene débito automático ni suscripciones: el pago es **push** desde la wallet del inquilino (coherente con self-custody — nadie puede mover sus fondos sin su llave). La app le recuerda y le facilita el push.
- **Observación on-chain:** la misma infraestructura de reconciliación del reporte (§4: `subscribe` + `account_tx`) detecta si el pago del período ocurrió antes de la fecha límite + gracia.

**Sinergia con la garantía (clave):**
- Como la renta es on-chain, **"¿pagó el inquilino?" es verificable objetivamente en el ledger.** La condición de impago deja de ser un juicio subjetivo del operador.
- Impago observado (sin `Payment` del período tras la gracia) → dispara la cobertura del aval: `EscrowFinish` libera al arrendador el/los mes(es) faltante(s) → reputación baja. Pago puntual → reputación sube.
- Esto **encoge el quorum humano a solo disputas** (p. ej. el inquilino alega pago fuera de banda, o retención legítima) y **reduce la dependencia de XLS-100**: gran parte de la "decisión de incumplimiento" se vuelve objetiva sin esperar Smart Escrows.

**API (recursos nuevos):**

| Método | Recurso | Qué hace |
|---|---|---|
| `POST` | `/v1/leases` | Registrar contrato (partes, monto/mes, periodicidad, token, hash) |
| `POST` | `/v1/leases/{id}/payments` | Construir/registrar el `Payment` mensual on-chain (lo firma la wallet del inquilino) |
| `GET` | `/v1/leases/{id}/ledger` | Estado de pagos: períodos pagados, vencidos, cubiertos por el aval |

Eventos: `rent.paid` · `rent.due` · `rent.missed` (→ encadena con `guarantee.claim_opened`/`executed`).

**Honestidad sobre el límite:** sin XLS-100 ni débito on-chain nativo, el inquilino debe *iniciar* el pago cada mes (push). Como su wallet es self-custody, nadie puede auto-debitarle — y eso es deseable: nadie mueve sus fondos sin su llave. El sistema reduce fricción (recordatorios, 1-tap) pero no la elimina.

---

## 12. KYC como puerto enchufable (integrar después)

El proveedor de KYC aún no está decidido (§9bis #3). Para no bloquear y poder integrarlo después **sin reescribir flujos**, se modela como un **puerto** (interfaz), igual que `KmsProvider` y `QuorumProvider` en el plan.

```
interface KycProvider {
  startVerification(userId, payload): Promise<{ sessionId, status }>
  getStatus(sessionId): Promise<'pending'|'approved'|'rejected'>
  // webhook del proveedor → normaliza a estos estados
}
```

- **MVP:** implementación `ManualKycProvider` (stub) — aprobación manual/sandbox. El sistema funciona end-to-end sin proveedor real.
- **Después:** se enchufa el proveedor mexicano (INE/CURP) implementando la misma interfaz; cero cambios en el onboarding ni en el motor.
- **Regla de negocio independiente del proveedor:** las **credentials de reputación (XLS-70)** solo se emiten/anclan a un usuario **después** de `status === 'approved'`. El gate KYC vive en la capa de aplicación, antes de tocar el core; el core sigue agnóstico.
- **Ubicación en el repo:** `packages/core/src/providers/kyc.ts` (interfaz + `ManualKycProvider`), consumido por la capa `users` de la API.

---

## 13. Segundo SDK: recomendación de lenguaje

Con el contrato OpenAPI, cualquier cliente puede autogenerar un SDK en casi cualquier lenguaje; los SDKs **oficiales** son señal de confianza y DX, así que se invierten donde más reducen fricción para los clientes reales (plataformas de renta).

| Candidato | A favor | En contra | Veredicto |
|---|---|---|---|
| **PHP** (Laravel / WordPress) | Es el stack dominante de portales inmobiliarios y de listings en LatAm; ahí está la mayor fricción de integración | Comunidad cripto/fintech más chica | ✅ **Segundo SDK** |
| **Python** | Fuerte en fintech, backends, scripting y data | Menos común en el portal inmobiliario típico que integra | Tercero, **por demanda** |
| **Java / C#** | Enterprise, aseguradoras grandes | Sobredimensionado para la PyME inmobiliaria objetivo | Solo si entra un cliente enterprise |

**Recomendación:** TypeScript (ya planeado, cubre Node + web + la app móvil) → **PHP** como segundo SDK oficial, por concentración del mercado objetivo → Python autogenerado/comunidad si la demanda aparece. El resto, vía generador OpenAPI bajo soporte "community".

> Matiz: el TS-SDK ya cubre a los integradores en Node y a nuestra propia app móvil. El PHP-SDK no añade capacidad, añade **adopción** en el segmento donde más cuesta integrar hoy. Si el primer cliente real resulta ser Node, se puede posponer el PHP-SDK sin costo arquitectónico.
