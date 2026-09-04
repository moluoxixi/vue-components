# Vite Config Frontend Guidelines

## Overview

These guidelines route changes in `vite-config`'s frontend layer to the repository
contract and the package-specific contracts that contain real project rules.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based feature folders and public boundaries | Ready |
| [Public Addon Entries](./public-addon-entries.md) | Root, aggregate, leaf, declaration, and packed-entry contract | Ready |

## Pre-Development Checklist

- Read [Repository Directory Structure](../../directory-structure.md) before creating or moving modules.
- Read [Public Addon Entries](./public-addon-entries.md) before changing addon option types, helpers, exports, or build entries.
- Read each package-specific contract relevant to the files and behavior being changed.
- Run the validation commands required by those contracts.
