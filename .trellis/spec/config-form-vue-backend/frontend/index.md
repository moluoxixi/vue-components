# Config Form Vue Backend Frontend Guidelines

## Overview

These guidelines route changes in `config-form-vue-backend` to the shared
ConfigForm contracts that own Canonical-to-Runtime projection.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Runtime/Studio projection, listener, serialization, and event exclusions | Ready |
| [Studio Domain Contracts](../../config-form/frontend/studio-domain-contracts.md) | Surface artifacts, Prototype Runtime boundary, versions, and diagnostics | Current contract |
| [Runtime State Boundaries](../../config-form/frontend/runtime-state-boundaries.md) | Renderer state, validation, Data, and host listener behavior | Ready |

## Pre-Development Checklist

- Read the product boundary before changing Runtime node or page plans.
- Read the Studio domain contract before changing Surface artifacts, overlay presentation, target identity, or generated-project parity.
- Read Runtime state boundaries before changing bindings or listener projection.
- Run Vue backend tests, typecheck, build, and downstream Runtime tests.
