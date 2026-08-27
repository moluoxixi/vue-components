# Shared AI Provider Contracts

## 1. Scope / Trigger

Apply this contract when changing `@moluoxixi/ai-provider`, adding an AI consumer, migrating provider configuration, or changing OpenAI-compatible chat/embedding transport. The package is infrastructure shared across products, so public DTOs, secret handling, cancellation, and error semantics must stay consumer-neutral.

## 2. Signatures

```ts
loadProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
  options: { defaults: ProviderDefaults, envKeys: ProviderEnvKeys },
): ProviderConfig | null

providerStatusOf(config: ProviderConfig | null): ProviderStatus

streamChat(
  config: ProviderConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
  options?: ProviderTransportOptions,
): AsyncGenerator<string>

embed(
  config: ProviderConfig,
  inputs: string[],
  signal?: AbortSignal,
  options?: ProviderTransportOptions,
): Promise<number[][]>
```

Package exports are split by capability:

```text
@moluoxixi/ai-provider         browser-safe DTOs and stable errors
@moluoxixi/ai-provider/shared  browser-safe DTOs and stable errors
@moluoxixi/ai-provider/server  secrets, env loader, transport, causes, redaction
```

## 3. Contracts

- Consumers own their environment variable names and defaults. Shared code must not introduce product-specific `AI_DOC_*` or `I18N_TOOL_*` defaults.
- A missing chat API key returns `null`; an embedding key may be empty. `providerStatusOf()` is the only browser-safe projection of secret availability.
- `ProviderConfig`, `ProviderEnvKeys`, transport helpers, diagnostic causes, and redaction stay under `./server`.
- Chat sends an OpenAI-compatible streaming request to `/chat/completions`; embedding sends a JSON request to `/embeddings`.
- An `AbortSignal` is passed unchanged to `fetch`. Abort remains the original `AbortError` and is never wrapped as an upstream failure.
- A chat stream succeeds only after `[DONE]`. EOF without `[DONE]` is `UPSTREAM_PROTOCOL_ERROR`; the reader is cancelled on early completion or failure and its lock is released.
- Public `AiProviderError` contains only stable `code`, `message`, `retryable`, and optional `status`. Internal causes remain in a server-only `WeakMap` and are never serialized.
- Redaction covers raw secrets and URI/form-encoded variants before diagnostic text can leave a server boundary.

## 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Chat key missing | `loadProviderConfig()` returns `null` |
| `fetch` rejects with `AbortError` | Re-throw the same abort error |
| Network failure | `UPSTREAM_NETWORK_ERROR`, retryable |
| HTTP 408, 429, or 5xx | `UPSTREAM_HTTP_ERROR`, retryable with status |
| Other non-2xx HTTP status | `UPSTREAM_HTTP_ERROR`, not retryable with status |
| Missing/malformed SSE terminal | `UPSTREAM_PROTOCOL_ERROR` |
| Malformed embedding JSON/vector | `UPSTREAM_PROTOCOL_ERROR` |
| Embedding result count differs from input count | `EMBEDDING_COUNT_MISMATCH` |
| Empty embedding input | Return `[]` without an upstream request |

## 5. Good / Base / Bad Cases

- Good: a consumer maps its legacy env keys into `ProviderEnvKeys`, preserving old behavior while sharing transport.
- Base: chat is configured and embedding is not; status is `{ chat: 'configured', embedding: 'missing' }`.
- Bad: exporting `ProviderConfig` from the package root makes secret-bearing types available to browser code.
- Bad: treating clean SSE EOF as completion accepts truncated model output.

## 6. Tests Required

- Config tests assert consumer-defined env mapping, defaults, missing chat key, and optional embedding key.
- Chat tests assert tokens, exactly one terminal, CRLF/LF framing, malformed JSON, missing `[DONE]`, HTTP classification, abort identity, reader cancellation, and lock release.
- Embedding tests assert schema validation, count validation, HTTP/network errors, abort, and the empty-input fast path.
- Error/redaction tests assert that public errors contain no cause and raw/encoded secrets are removed.
- Build and packed-package tests assert that root/shared browser bundles contain no server endpoints, secret field names, or server-only imports.
- Every migrated consumer runs its compatibility suite to preserve its existing env keys and defaults.

## 7. Wrong vs Correct

### Wrong

```ts
export type { ProviderConfig } from './server/config'
catch (error) {
  throw new AiProviderError('UPSTREAM_NETWORK_ERROR', String(error))
}
```

### Correct

```ts
export type { ProviderStatus } from './shared'

catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError')
    throw error
  throw createAiProviderError('UPSTREAM_NETWORK_ERROR', 'chat upstream request failed', {
    cause: error,
    retryable: true,
  })
}
```
