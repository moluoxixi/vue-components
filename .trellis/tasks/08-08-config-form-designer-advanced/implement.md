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
25. [x] Move the generic component registration contract to headless and support direct components plus binding-aware registration objects in Renderer and legacy Runtime.
26. [x] Add Element Plus and Ant Design Vue semantic aliases and route designer property controls through the active registry.
27. [x] Add serializable node extensions across headless, legacy Runtime, designer parsing, compilation, history, slots, and readonly contexts without prop leakage.
28. [x] Run package tests, typechecks, builds, export-boundary checks, full quality gates, and browser verification for both designer adapters.
29. [x] Convert ConfigForm Core into the dependency-free owner of shared JSON/condition/reaction types, pure evaluation, stable transaction execution, and cycle diagnostics; make Headless consume it without a package cycle.
30. [x] Integrate value/state/props/validation effects with Controller and ConfigFormRenderer without mutating field definitions or leaking reaction metadata.
31. [x] Add designer reaction document schema, reference diagnostics, compiler/history round-trip, visual setter, and isolated canvas preview.
32. [x] Verify real Element Plus and Ant Design Vue reaction behavior, chained convergence, cycles, validation timing, export boundaries, and desktop/narrow designer interaction.
33. [x] Add dependency-free Core reaction configuration factories and immutable editing helpers with focused public API tests.
34. [x] Replace Designer reaction protocol mutations with Core helpers while preserving visual behavior and exported JSON.
35. [x] Verify the reuse boundary: Reaction execution/config remain in Core, Vue-aware slots remain in Headless, and Designer JSON slots remain document-owned.
36. [x] Consolidate Element Plus and Ant Design Vue option-source contracts and pure normalization/cache helpers in Designer while preserving adapter APIs.
37. [x] Add the deterministic Core named-module registry and Headless component-material specialization with focused error, ordering, and compatibility tests.
38. [x] Move Element Plus and Ant Design Vue runtime aliases to `src/materials/<name>.ts` and generate their existing public component maps through eager file scanning.
39. [x] Split both designer-adapter material catalogs into co-located named modules containing definition, order, and locale, then generate the existing public arrays/locales through the same registry contract.
40. [x] Verify caller override precedence, material key/order parity, readonly/binding behavior, type declarations, builds, and published export boundaries across all affected ConfigForm packages.
41. [x] Add a maintained ConfigForm architecture README, link it from the repository root, document declaration-versus-registration ownership, and define same-change documentation rules for future boundary changes.

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
- [x] Core, Headless, Runtime, Designer, Element Plus, Ant Design Vue, and both designer-adapter reaction suites (357 tests)
- [x] `pnpm test:config-form-packages` public package-boundary verification
- [x] Full Playground Playwright suite (16 passed, including visual reaction editing for both adapters at desktop and 390px)
- [x] Core reducer depth guard returns `CONFIG_FORM_REACTION_DEPTH_EXCEEDED` instead of an uncontrolled recursion failure
- [x] Core reaction configuration helper tests, cross-node reaction-id uniqueness, Designer options contract tests, and adapter compatibility tests
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, package boundary verification, and live Element Plus/Ant Design Vue standalone-designer checks
- [x] ConfigForm scoped ESLint, 196 affected-package tests, and all seven affected package typechecks
- [x] `pnpm test:config-form-packages` with explicit Core build plus Core/Headless/Designer/adapter Node self-reference and declaration consumers
- [x] Independent 17-item Element Plus and 22-item Ant Design Vue material/runtime/locale parity review
- [ ] Full workspace lint/typecheck (blocked by unrelated in-progress docs/theme changes; ConfigForm scope is green)

## Risk Gates

- Do not change numeric document semantics while adding responsive presets.
- Do not let core designer code fetch remote options.
- Add round-trip tests before changing compiler/runtime public types.
