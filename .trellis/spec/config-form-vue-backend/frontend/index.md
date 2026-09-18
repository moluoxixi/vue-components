# Config Form Vue Backend Frontend Guidelines

## Overview

These guidelines route changes in `config-form-vue-backend` to the shared
ConfigForm contracts that own Canonical-to-Runtime projection.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Runtime-first projection, listener, and serialization boundary | Ready |
| [Runtime State Boundaries](../../config-form/frontend/runtime-state-boundaries.md) | Renderer state, validation, Data, and host listener behavior | Ready |

## Pre-Development Checklist

- Read the product boundary before changing Runtime node or page plans.
- Read Runtime state boundaries before changing bindings or listener projection.
- Run Vue backend tests, typecheck, build, and downstream Runtime tests.
