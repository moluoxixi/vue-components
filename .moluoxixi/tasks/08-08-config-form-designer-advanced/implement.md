# Implementation Plan

1. [x] Correct the Playground baseline to a 24-cell grid and add regression coverage for explicit 12-cell container spans.
2. [x] Add responsive breakpoint types, schema parsing, compiler passthrough, designer breakpoint controls, and runtime CSS-variable resolution.
3. [x] Add normalized option-source types and adapter resolver hooks; update Element Plus static/default option flows and state UI.
4. [x] Add designer-local mock model state, pure condition evaluation, and visual linkage preview controls.
5. [x] Add default/rule diagnostic projection and export validation without document mutation.
6. [x] Run scoped unit tests, typechecks, builds, desktop/narrow E2E, then perform cross-layer review.
7. [x] Add the Ant Design Vue designer adapter with material, option, readonly, locale, unit, type, and build parity.
8. [x] Add a visual framework switch and adapter-specific sample documents to the standalone designer.
9. [x] Remove shadcn packages and all supported-code, test, documentation, release, verification, and lockfile references.
10. [x] Run full package-boundary, unit, typecheck, build, desktop/narrow browser, and cross-layer verification.
11. [x] Replace node-sized selection outlines with observed component-sized overlays as an intermediate iteration and update drag/action E2E selectors.
12. [x] Add password, search, autocomplete, slider, and rate Ant Design Vue materials with locale, readonly/default, option-source, unit, and browser coverage.
13. [x] Run scoped tests, typechecks, builds, desktop/mobile geometry checks, then rerun the full quality gate.
14. [x] Make root-only span ownership explicit, hide ineffective nested Span setters, and cover `24 / 8 / 8 / 8` parity in Runtime and designer tests.
15. [x] Share Runtime span/field-layout projections with the designer, apply adapter Runtime namespaces/styles, and verify intrinsic controls plus full-row cell footprints in Runtime before the designer.
16. [x] Replace the dual measured-component/span chrome with one focus-bound full-node frame, attach actions to its top-right edge, and verify focus-loss behavior.
17. [x] Replace generic nested container framing with one icon-only empty drop surface, native non-empty flow, and adapter-specific Section/Flex/Grid visual guides.
18. [x] Add DOM, computed-style, drag-state, Element Plus/Ant Design Vue, desktop/mobile, and browser screenshot verification for the container canvas language.
19. [x] Move simple top-level property setters to a left-label grid while keeping structured/custom setters full width.
20. [x] Add unit, computed-layout, desktop, English/Chinese, and narrow-screen verification for property-panel label placement.
21. [x] Add a layered property-control registry contract without introducing concrete UI imports in designer core.
22. [x] Project ordinary and custom setters through one ConfigFormRenderer while preserving update-path/history behavior.
23. [x] Register real Element Plus and Ant Design Vue property controls with their native value bindings.
24. [x] Add core, adapter, E2E, desktop, narrow-screen, and clean-build verification for the ConfigForm-backed property panel.

## Validation Commands

- `pnpm --filter @moluoxixi/config-form-designer test -- --run`
- `pnpm --filter @moluoxixi/config-form-designer typecheck`
- `pnpm --filter @moluoxixi/config-form-designer-element-plus test -- --run`
- `pnpm --filter @moluoxixi/config-form-designer-element-plus typecheck`
- `pnpm --filter @moluoxixi/config-form-designer-antd-vue test -- --run`
- `pnpm --filter @moluoxixi/config-form-designer-antd-vue typecheck`
- `pnpm --filter @moluoxixi/config-form-designer-antd-vue build`
- `pnpm --filter @config-form/playground typecheck`
- `pnpm --filter @config-form/playground build`
- `CONFIG_FORM_PLAYGROUND_PORT=4331 pnpm --filter @config-form/playground test:e2e -- --grep "designer|designer entry"`

## Final Validation

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm --filter @moluoxixi/config-form test:coverage` (95.88% functions, 95.75% statements)
- [x] `pnpm build`
- [x] `pnpm --filter @config-form/playground build`
- [x] Full Playground Playwright suite (14 passed, including root span parity and Element Plus/Ant Design Vue designer layout/readonly coverage)
- [x] Cross-layer review of document, compiler, Designer, Element Plus/Ant Design Vue adapters, and Runtime boundaries

## Risk Gates

- Do not change numeric document semantics while adding responsive presets.
- Do not let core designer code fetch remote options.
- Add round-trip tests before changing compiler/runtime public types.
