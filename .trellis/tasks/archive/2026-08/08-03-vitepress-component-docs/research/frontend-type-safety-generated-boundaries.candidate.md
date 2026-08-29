# Type Safety

> Type safety patterns in this project.

---

## Overview

<!--
Document your project's type safety conventions here.

Questions to answer:
- What type system do you use?
- How are types organized?
- What validation library do you use?
- How do you handle type inference?
-->

(To be filled by the team)

---

## Scenario: Preserve types across generated and published boundaries

### 1. Scope / Trigger

- Apply this contract when extracting referenced TypeScript types for documentation, generating ESM declarations, or writing generic collection helpers.
- Generated type details must describe the source type graph, not identifier-shaped text found inside it.
- Published declarations must resolve under `moduleResolution: "NodeNext"`, even when the repository itself compiles with bundler resolution.

### 2. Signatures

```ts
collectReferencedTypeDefinitions(options: {
  rootType: string
  definitions: ReadonlyMap<string, string>
}): string[]

finalizeDeclarationSpecifiers(options: {
  declarationRoot: string
  publicTypeEntries: readonly string[]
}): void

collectNodes<TValue, TComponent>(
  nodes: readonly Node<TValue, TComponent>[],
): Array<Field<TValue, TComponent>>
```

### 3. Contracts

- Parse type definitions with the TypeScript AST. Traverse `TypeReferenceNode`, generic constraints/defaults, conditional types, mapped/indexed access types, `infer`, tuples, intersections/unions, and nested declarations.
- Ignore identifiers that occur only inside string/template literal types, property names, comments, or unrelated value expressions.
- Track visited declarations to terminate recursive and mutually recursive type graphs while retaining each reachable definition once.
- Rewrite every relative declaration module specifier to an explicit `.js` file or `/index.js` target that exists beside the emitted `.d.ts` graph.
- Verify every public `types` export with a NodeNext TypeScript consumer after declaration finalization.
- Generic helpers must carry caller-supplied narrow parameters through inputs, recursion, intermediate state, and return types. Do not widen a renderer/component type to a shared base merely to simplify implementation.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Alias contains `'Other'` and an unrelated `Other` declaration exists | Do not include `Other` |
| Generic constraint references `Dependency` | Include `Dependency` even when it appears before `=` |
| Type graph is recursive | Emit every reachable definition once and terminate |
| Relative declaration resolves to `foo.d.ts` | Emit `./foo.js` |
| Relative declaration resolves to `foo/index.d.ts` | Emit `./foo/index.js` |
| Relative declaration target is missing or ambiguous | Fail the package build with the source declaration path |
| Helper receives `TComponent = 'input' | 'select'` | Preserve that union in the returned field type |

### 5. Good/Base/Bad Cases

- Good: AST traversal expands a generic payload and all reachable aliases without treating literal text as a type name.
- Good: the package's root, component subpaths, and loader subpath pass an external NodeNext type check and Node ESM import smoke.
- Base: a primitive or built-in-only type produces no custom type detail.
- Bad: `/\b[A-Za-z_$][\w$]*\b/g` scans the raw type string for dependencies.
- Bad: emitted ESM declarations contain `export * from './src'` in a `type: "module"` package.
- Bad: a recursive helper accepts `TComponent` but returns `Component | string`.

### 6. Tests Required

- AST dependency tests: literals, comments, generic constraints/defaults, conditional types, `infer`, recursive aliases, and missing definitions.
- Declaration tests: file targets, directory targets, query/hash rejection if unsupported, missing targets, and all public package type entries.
- Consumer tests: compile a fixture with `module: "NodeNext"` and `moduleResolution: "NodeNext"` against packed/built exports.
- Runtime packaging smoke: import the root entry, representative component subpath, and loader subpath in Node ESM.
- Generic preservation: use compile-time assertions proving a narrow component/renderer union survives collection and recursive traversal.

### 7. Wrong vs Correct

#### Wrong

```ts
const dependencies = rawType.match(/\b[A-Za-z_$][\w$]*\b/g) ?? []
export function collect<T>(nodes: Node<T, Narrow>[]): Field<T, Component | string>[]
```

#### Correct

```ts
const sourceFile = ts.createSourceFile('types.ts', rawType, ts.ScriptTarget.Latest, true)
visitTypeNodes(sourceFile, dependencyNames)

export function collect<T, TComponent>(
  nodes: Node<T, TComponent>[],
): Field<T, TComponent>[]
```

---

## Type Organization

<!-- Where types are defined, shared types vs local types -->

(To be filled by the team)

---

## Validation

<!-- Runtime validation patterns (Zod, Yup, io-ts, etc.) -->

(To be filled by the team)

---

## Common Patterns

<!-- Type utilities, generics, type guards -->

(To be filled by the team)

---

## Forbidden Patterns

<!-- any, type assertions, etc. -->

(To be filled by the team)
