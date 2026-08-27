# I18n Local Service Safety Contracts

## 1. Scope / Trigger

Apply this contract when changing `@moluoxixi/i18n-tool` config resolution, local HTTP routes, resource scanning, translation streaming, preview/apply, or filesystem writes. Although the service binds locally, browser input, model output, config-derived paths, and concurrent disk changes cross trust boundaries.

## 2. Signatures

```ts
class ServerContext {
  sanitizedConfig(): SanitizedConfigResponse
  scan(): Promise<ScanResponse>
  translate(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateSseEvent>
  preview(request: PreviewRequest): Promise<PreviewResponse>
  apply(previewToken: string): Promise<ApplyResponse>
}

createPathGuard(root: string): Promise<{
  canonicalRoot: string
  resolve(relativePath: string, options?: { allowMissing?: boolean }): Promise<string>
}>
```

The write protocol is strictly:

```text
scanId + resource/unit IDs -> translate -> reviewed candidates
-> previewToken + structured files/diff -> apply(previewToken) -> fresh scan
```

## 3. Contracts

- `i18n-tool.config.ts/.mts/.js/.mjs` is the runtime source of truth. The browser receives project name, relative resource configuration, model/base URL, and configured/missing status only; it never receives the API key value, API key env name, or absolute paths.
- Browser requests contain server-issued `scanId`, `resourceId`, unit IDs, and `previewToken`. They never contain arbitrary absolute paths or client-authored write operations.
- Mutating routes require JSON media type, the private request header, and an HTTP same-origin `Origin` or `Referer`; same host with a different scheme is not same-origin.
- Scan traverses and reads incrementally under configured file, byte, key, depth, and concurrency limits. It rejects symlink/junction segments and paths outside both lexical and canonical roots.
- Locale, namespace, and pattern segments must be valid filesystem segments. Windows-invalid characters, device names, trailing dots/spaces, and case-insensitive source/target collisions are rejected during config validation.
- Translation accepts configured target locales and source units from the referenced scan only. Family members stay scoped to their resource. The concurrency slot is acquired before the async generator's first yield and released in `finally`.
- Model output is decoded with runtime schemas and revalidated against opaque unit IDs, target locale, family membership, key count, and protected tokens. The model never controls file paths or locale naming.
- Preview rechecks scan freshness, target locale/candidate consistency, overwrite approvals, path containment, output limits, adapter serialization, and round-trip parsing. Only a valid preview receives a short-lived token.
- Apply accepts only an unused token, rechecks every target path and baseline hash before writing, revalidates operations, writes atomically in the target directory, then rescans.
- Multi-file failure rolls back in reverse order. A token remains reusable only after complete rollback; incomplete rollback consumes it and returns `WRITE_FAILED`.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Unknown scan/unit, duplicate unit, locale mismatch | `INVALID_REQUEST` (400) |
| Missing AI key | `AI_NOT_CONFIGURED` (409) |
| Body, file, byte, key, depth, or concurrency limit exceeded | `PAYLOAD_TOO_LARGE` or `LIMIT_EXCEEDED` |
| Lexical root escape | `PATH_OUTSIDE_ROOT` (403) |
| Symlink/junction or canonical escape | `SYMLINK_ESCAPE` (403) |
| Missing/used/applying preview token | `PREVIEW_REQUIRED` (409) |
| Expired preview or changed scan resource | `PREVIEW_STALE` (409) |
| Target baseline/path/operation changed | `WRITE_CONFLICT` (409) |
| Model schema or protected-token mismatch | Diagnostic/no preview; never write |
| Apply fails and rollback completes | Return original error; token remains reusable |
| Apply fails and rollback is incomplete | `WRITE_FAILED` (500); token consumed |
| Client disconnects during translation | Abort upstream transport; do not emit another terminal event |

## 5. Good / Base / Bad Cases

- Good: a missing target locale file is derived by the adapter, shown as `create`, confirmed, atomically written, and returned in a fresh scan.
- Base: target entries are missing or empty; they enter the default translation scope without overwrite approval.
- Good: an existing non-empty value enters preview only after explicit selection and overwrite approval, and is marked `overwriteRequired` in the structured operations.
- Bad: accepting a browser-supplied path or operation lets the UI bypass adapter and containment rules.
- Bad: checking only `resolve(root, relative)` misses symlink escape and Windows case collisions.
- Bad: writing before all files pass baseline validation creates avoidable partial commits.

## 6. Tests Required

- Config/CLI tests assert discovery order, explicit config/root/host/port/open overrides, empty inline values, segment validation, path collisions, and sanitized status.
- Scanner/path tests assert streaming limits, missing paths, lexical escape, canonical escape, symlink/junction rejection, and TOCTOU-aware byte caps.
- Translation tests assert adapter families, protected tokens, bad model JSON, retry subsets, configured locales, cancellation, and one SSE terminal.
- Preview tests assert unknown units, locale mismatch, overwrite approval, target collision, round-trip validation, limits, TTL, and stale scan hashes.
- Apply tests assert repeated path checks, atomic create/update, write locks, conflicts, reverse rollback, token reuse after complete rollback, token consumption after incomplete rollback, and successful rescan.
- Browser E2E asserts create, overwrite, stale conflict, invalid output, cancel, keyboard/dialog behavior, and mobile/tablet overflow.
- Packed browser output must exclude server exports, absolute-path fields, env-key fields, filesystem imports, and write helpers.

## 7. Wrong vs Correct

### Wrong

```ts
await writeFile(request.absolutePath, JSON.stringify(request.operations))
```

### Correct

```ts
const preview = requireUnusedPreview(request.previewToken)
await assertBaselinesAndPaths(preview.files)
for (const file of preview.files)
  await writeTextAtomically(file.absolutePath, file.after, { validateTarget })
return { filesWritten: preview.files.length, scan: await context.scan() }
```
