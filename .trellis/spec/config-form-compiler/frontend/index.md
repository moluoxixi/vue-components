# Config Form Compiler Frontend Guidelines

## Overview

These guidelines route changes in `config-form-compiler` to the shared ConfigForm
contracts that own Canonical IR, compilation, and versioned output.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [ConfigForm Product Boundaries](../../config-form/frontend/product-boundaries.md) | Runtime-first compilation and serialization boundary | Ready |
| [ConfigForm Architecture Documentation](../../config-form-core/frontend/architecture-documentation.md) | Architecture facts and current-contract-only policy | Ready |

## Pre-Development Checklist

- Read the product boundary before changing Canonical IR or Runtime plan output.
- Read the current-contract-only policy before changing Compiler/IR versions.
- Run Compiler tests and typecheck plus downstream Vue backend tests.
