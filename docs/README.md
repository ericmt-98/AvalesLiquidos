# Mapa de documentación y gobernanza de docs

> Este archivo es el **índice y las reglas** de toda la documentación del proyecto. Si vas a crear o cambiar un doc, lee primero las reglas de orden (§3).

**Estado:** estable · **Actualizado:** 2026-06-18 · **Dueño:** equipo Avales Líquidos

---

## 1. Jerarquía de fuente de verdad (una sola por dominio)

Para evitar contradicciones, cada hecho vive en **un** lugar canónico; lo demás **enlaza, no repite**.

| Dominio | Fuente de verdad | Archivo |
|---|---|---|
| Motor / semántica XRPL | Reporte técnico v4.1 | `reporte_v4_fuente_de_verdad.md` |
| Producto / arquitectura de integración | Arquitectura de producto | `arquitectura_producto.md` |
| Decisiones y su porqué | Registro de decisiones (ADR-log) | `docs/decisions.md` |
| Plan de ejecución | Plan de implementación | `plan_implementacion_mvp.md` |
| Referencia de API | Generada del contrato | `openapi/openapi.yaml` → `docs/api-reference/` |

**Regla de oro:** si un dato aparece en dos docs y discrepan, gana la fuente de verdad de la tabla. Los demás docs se corrigen para enlazar a ella.

---

## 2. Estructura objetivo del repo (documentación)

```
/                                  # front-door de GitHub
├─ README.md                       # héroe: qué/para quién/estado/quickstart/posicionamiento + link a DISCLAIMER  [pendiente: requiere código]
├─ DISCLAIMER.md                   # aviso legal/regulatorio (software de referencia)                              [creado]
├─ LICENSE                         # Apache-2.0                                                                    [creado]
├─ SECURITY.md                     # reporte de vulnerabilidades                                                   [pendiente]
├─ CONTRIBUTING.md                 # cómo contribuir + setup dev                                                   [pendiente]
├─ CODE_OF_CONDUCT.md                                                                                              [pendiente]
├─ CHANGELOG.md · ROADMAP.md                                                                                       [pendiente]
├─ .github/                        # plantillas de issues/PR, discussions                                         [pendiente]
├─ reporte_v4_fuente_de_verdad.md  # fuente de verdad: motor
├─ arquitectura_producto.md        # fuente de verdad: producto
├─ plan_implementacion_mvp.md      # plan de ejecución
└─ docs/
   ├─ README.md                    # este archivo (mapa + gobernanza)
   ├─ decisions.md                 # registro de decisiones (ADR-log)                                              [creado]
   ├─ decisions/                   # ADRs individuales cuando una decisión crece                                  [futuro]
   ├─ xrpl-gotchas.md              # errores comunes de escrow XRPL (de los hallazgos v3→v4) — material faro       [pendiente]
   ├─ threat-model.md              # límites de confianza y custodia                                               [pendiente]
   ├─ glossary.md                  # glosario bilingüe de conceptos                                                [pendiente]
   ├─ integration-guide.md         # para plataformas de renta (adoptantes) — ES                                  [pendiente: requiere API]
   ├─ operator-guide.md            # para quien opera el pool: deploy, KMS/quorum, checklist regulatoria — ES      [pendiente]
   ├─ api-reference/               # generado de openapi.yaml — EN                                                 [pendiente]
   └─ history/                     # archivo (p. ej. reporte_corregido_final.md = v3)                              [pendiente: mover]
```

> Reorganización pendiente (no destructiva, se hará al iniciar el repo): mover `reporte_corregido_final.md` → `docs/history/`. Los tres docs raíz de diseño pueden quedarse en raíz o moverse a `docs/` al crear el monorepo.

---

## 3. Reglas de orden (cómo evitamos malentendidos)

1. **Una fuente de verdad por dominio** (§1). No repetir; enlazar.
2. **Toda decisión consecuente → entrada en `docs/decisions.md`** (contexto → decisión → consecuencias, fechada). El *porqué* vive ahí; los docs grandes enlazan al ADR en vez de incrustar rationale que deriva.
3. **Cabecera de estado** en cada doc: `Estado: borrador|estable · Actualizado: AAAA-MM-DD · Dueño: …`.
4. **Docs en el mismo PR que el código.** Si cambia el comportamiento, cambia el doc en el mismo commit. Lo generado (API) nunca se edita a mano.
5. **Divergencias del reporte se marcan, no se ocultan** (ej. asentamiento directo vs §7.4; renta on-chain no está en el reporte). Etiqueta explícita en el doc + ADR.

---

## 4. Convención de idioma

Decisión 2026-06-18: **inglés para lo técnico/global, español para adopción/mercado.**

| Superficie | Idioma |
|---|---|
| README, ARCHITECTURE, API reference, CONTRIBUTING, ADRs públicos | **Inglés** (comunidad XRPL global) |
| Guía de integración, guía de operador, material de mercado, DISCLAIMER | **Español** (México/LatAm) |
| Docs de diseño internos actuales (reporte, arquitectura, plan, decisions) | **Español** (lengua de trabajo); se traduce/resume al publicar |

> Nunca mantener dos versiones del *mismo* doc en paralelo salvo que un proceso garantice que no derivan (riesgo de contradicción).

---

## 5. Convención de nombres y estado

- Archivos en `kebab-case.md`.
- Una sola versión canónica por dominio (patrón "fuente de verdad"); el histórico va a `docs/history/`.
- Badges de madurez en README: el proyecto está en **PoC / testnet**; marcarlo visiblemente para que nadie despliegue capital en mainnet.
