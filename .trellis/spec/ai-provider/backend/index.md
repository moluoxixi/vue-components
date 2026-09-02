# AI Provider Backend Guidelines

## Overview

These guidelines define the reusable provider boundary shared by server-side AI consumers.

## Guidelines Index

| Guide | Description | Status |
| --- | --- | --- |
| [Repository Directory Structure](../../directory-structure.md) | Responsibility-based module layout and public boundaries | Ready |
| [Provider Contracts](./provider-contracts.md) | SDK model factories, target validation, public exports, secret-free status, errors, and redaction | Ready |

## Pre-Development Checklist

- Read the repository directory contract before adding or moving provider modules.
- Read [Provider Contracts](./provider-contracts.md) before changing Provider targets, model factories, errors, or package exports.
- Identify whether each new symbol is browser-safe or server-only before exporting it.
- Run provider tests, type-check, build, packed Node smoke, and packed browser smoke after boundary changes.
