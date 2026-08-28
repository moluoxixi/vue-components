# I18n Local Service Safety Contracts

## 1. Scope / Trigger

Apply this contract when changing `@moluoxixi/i18n-tool` config resolution, Provider/model calls, local HTTP routes, translation progress, preview/apply, or filesystem writes. Browser input, model output, config-derived paths, and concurrent disk changes cross trust boundaries even though the service binds locally.

## 2. Signatures

```ts
type I18nToolAiConfigInput =
  | { provider: 'openai' | 'anthropic' | 'google', apiKeyEnv: string, model: string }
  | { provider: 'openai-compatible', apiKeyEnv: string, model: string, baseUrl: string }

translateBatch(
  model: LanguageModel,
  batch: TranslationBatch,
  targetLocale: string,
  signal?: AbortSignal,
): Promise<TranslationValidationResult>

class ServerContext {
  sanitizedConfig(): SanitizedConfigResponse
  scan(): Promise<ScanResponse>
  translate(request: TranslateRequest, signal?: AbortSignal): AsyncGenerator<TranslateSseEvent>
  preview(request: PreviewRequest): Promise<PreviewResponse>
  apply(previewToken: string): Promise<ApplyResponse>
}
```

The write protocol remains:

```text
scanId + resource/unit IDs -> translate -> reviewed candidates
-> previewToken + structured files/diff -> apply(previewToken) -> fresh scan
```

## 3. Contracts

- `i18n-tool.config.ts/.mts/.js/.mjs` is the source of truth. `ai.provider`, `ai.model`, and `ai.apiKeyEnv` are explicit; only OpenAI-compatible requires and exposes `baseUrl`.
- `ServerContext` reads the named key from server environment, creates an SDK `LanguageModel` through `@moluoxixi/ai-provider/server`, and passes it to `generateText`.
- AI SDK v7 uses `generateText({ model, instructions, prompt, abortSignal })`; do not recreate chat messages, streaming transport, or a `ChatTransport` injection surface.
- Sanitized config exposes provider, model, compatible endpoint, and configured/missing only. It never exposes the key value, env key name, absolute paths, or Provider target/model objects.
- `TranslateSseEvent` is the tool's business progress protocol for candidate/diagnostic/progress/done/error. It is not a model transport and remains independent of AI SDK streaming.
- Browser requests contain server-issued scan/resource/unit IDs and preview tokens, never arbitrary paths or write operations.
- Model output is decoded and revalidated against opaque IDs, target locale, family membership, key count, and protected tokens. It never controls paths, locales, or writes.
- Preview rechecks freshness, overwrite approvals, path containment, output limits, serialization, and round-trip parsing. Apply accepts only an unused token, rechecks paths/hashes, writes atomically, and rescans.
- Multi-file failure rolls back in reverse order. A token remains reusable only after complete rollback.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Missing/unknown Provider, model, or API key env name | Config validation failure |
| Non-compatible Provider includes `baseUrl` | Config validation failure |
| Compatible Provider missing/invalid `baseUrl` | Config validation failure |
| Environment key has no value | `AI_NOT_CONFIGURED` (409) |
| Unknown scan/unit, duplicate unit, locale mismatch | `INVALID_REQUEST` (400) |
| Body/file/byte/key/depth/concurrency limit exceeded | `PAYLOAD_TOO_LARGE` or `LIMIT_EXCEEDED` |
| Lexical root escape | `PATH_OUTSIDE_ROOT` (403) |
| Symlink/junction or canonical escape | `SYMLINK_ESCAPE` (403) |
| Model schema, ID, family, or token mismatch | Diagnostic/no preview; never write |
| Client disconnects during translation | Abort `generateText`; emit no later terminal event |
| Missing/used/applying preview token | `PREVIEW_REQUIRED` (409) |
| Expired preview or changed scan resource | `PREVIEW_STALE` (409) |
| Target baseline/path/operation changed | `WRITE_CONFLICT` (409) |
| Rollback incomplete | `WRITE_FAILED` (500); token consumed |

## 5. Good / Base / Bad Cases

- Good: explicit Anthropic config omits `baseUrl`, a server key creates the model, and only candidates/progress cross to the browser.
- Base: missing key reports `missing`; scanning remains available while translate returns `AI_NOT_CONFIGURED`.
- Good: an existing translation enters preview only after explicit overwrite approval and is atomically written after confirmation.
- Bad: exposing `apiKeyEnv` or a secret-bearing target lets browser output reveal server configuration.
- Bad: accepting a browser path/operation or model-authored ID lets callers bypass containment and adapter rules.

## 6. Tests Required

- Config tests cover all four Provider branches, required fields, compatible-only URL rules, discovery/CLI precedence, segment validation, and collisions.
- Translation tests use `MockLanguageModelV3`, assert SDK prompt/instructions, protected tokens, families, invalid JSON/schema, retry subsets, and pre-call abort.
- Router tests assert one business terminal event and that HTTP disconnect reaches the SDK model `abortSignal`.
- Context tests assert sanitized provider/model/status, compatible endpoint only, no secret/env name, family expansion, and concurrency release.
- Preview/apply tests retain path, freshness, overwrite, atomic write, rollback, token, and rescan assertions.
- Browser E2E uses an AI SDK compatible JSON upstream and covers create, overwrite, stale conflict, invalid output, cancel, dialogs, and mobile overflow.
- Build and packed browser smoke exclude server exports, `apiKeyEnv`, absolute paths, filesystem imports, and write helpers.

## 7. Wrong vs Correct

### Wrong

```ts
for await (const token of streamChat(providerConfig, messages, signal))
  output += token
```

### Correct

```ts
const model = createLanguageModel(target)
const { text } = await generateText({
  model,
  instructions: SYSTEM_PROMPT,
  prompt: JSON.stringify(request),
  abortSignal: signal,
})
```
