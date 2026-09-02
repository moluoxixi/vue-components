# I18n Tool Backend Guidelines

## Overview

These guidelines define the local service boundary for scanning, translating, previewing, and writing locale resources.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based module layout and public boundaries | Ready |
| [Local Service Safety](./local-service-safety.md) | Protocol, path containment, preview/apply, limits, atomic writes, and rollback | Ready |

## Pre-Development Checklist

- Read the repository directory contract before adding or moving service modules.
- Read [Local Service Safety](./local-service-safety.md) before changing config resolution, HTTP routes, scanning, preview/apply, or filesystem writes.
- Preserve the rule that the browser submits opaque IDs and tokens, never absolute paths or arbitrary write operations.
- Run unit tests, type-check, build, E2E, packed Node smoke, and packed browser smoke after boundary changes.
