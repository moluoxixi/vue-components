# AI Doc Assistant Quality Contracts

## Scenario: Untrusted AI answers and conversational query boundaries

### 1. Scope / Trigger

Apply this contract when changing AI answer rendering, chat history, `/query` validation, SSE parsing, source references, or browser E2E coverage in `packages/ai-doc-assistant`.

These paths cross the server/UI boundary and consume untrusted model or network output. A local-only fallback is not sufficient: server validation, shared types, UI behavior, and tests must continue to agree.

### 2. Signatures

```ts
renderMarkdown(source: string): string
buildChatHistory(turns: readonly HistoryTurn[]): ChatHistoryMessage[]
streamQuery(
  question: string,
  topK: number,
  history: ChatHistoryMessage[],
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void>
```

Shared limits live in `src/shared/protocol.ts`:

```ts
MAX_HISTORY_MESSAGES = 20
MAX_HISTORY_CHARACTERS = 20_000
```

The server router and UI history builder must import these constants rather than duplicate them.

### 3. Contracts

- History contains complete `user`/`assistant` pairs, starts with `user`, and preserves the newest continuous suffix.
- History has at most 20 messages and at most 20,000 JavaScript string characters. Do not split or truncate a pair. If the newest pair alone is too large, send no history.
- Successful SSE streams end with exactly one `done`. Failed streams end with exactly one `error`. EOF without either terminal event is an error; events after a terminal event are an error.
- Abort remains an `AbortError`/stopped state and must not be converted into an error answer or a completed answer.
- `SourceRef.docPath` and `SourceRef.score` are required. `source` and `knowledgeKey` are optional and must degrade without local casts or invented defaults.
- Markdown uses `markdown-it` with `html: false`. Only `http:`, `https:`, `mailto:`, relative paths, and fragments may create links. Protocol-relative and unknown-scheme URLs are rejected. HTTP(S) links use `target="_blank" rel="noopener noreferrer"`.
- Vue fenced blocks are removed from Markdown text segments and continue through `DemoPreview`; the Markdown renderer must never render them a second time.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| History has 21 messages | HTTP 400 `INVALID_REQUEST` |
| History exceeds 20,000 characters | HTTP 400 `INVALID_REQUEST` |
| History has an odd message count or wrong role order | HTTP 400 `INVALID_REQUEST` |
| Stream reaches EOF without `done/error` | Reject with explicit interrupted-stream error |
| Stream emits after `done/error` | Reject as protocol violation |
| User aborts | Preserve partial text as stopped; exclude the turn from future history |
| Model outputs raw HTML | Escape and display it as text |
| Model outputs `javascript:`, `data:`, `file:`, `vbscript:`, or `//host` link | Do not emit an anchor href |
| Optional source metadata is absent | Keep component/package/path/score display and component-name navigation fallback |

### 5. Good / Base / Bad Cases

- Good: 12 completed turns are reduced to the newest 10 complete pairs; the request passes server validation.
- Base: no completed turns produces `history: []` and the query proceeds normally.
- Bad: taking the newest 20 individual messages can start with an assistant message or split a pair, causing deterministic HTTP 400 failures.
- Good: `done` sets the turn to completed; `error` keeps the error state; an aborted controller produces stopped.
- Bad: treating a clean TCP/HTTP EOF as implicit `done` stores partial answers in later model context.
- Good: Markdown text and Vue Demo blocks render once in their respective components.
- Bad: enabling Markdown raw HTML or passing pre-rendered HTML into the component creates an XSS boundary the current sanitizer contract does not cover.

### 6. Tests Required

- Router tests: 20/21 messages, 20,000/20,001 characters, pair order, and non-empty content.
- UI history tests: newest suffix, character boundary, oversized newest pair, stopped/error exclusion.
- SSE client tests: `done`, `error`, missing terminal, post-terminal event, and abort with reader lock release.
- Markdown tests: headings/lists/code, raw HTML, mixed-case and encoded dangerous schemes, protocol-relative URLs, external-link attributes, and incomplete streaming fences.
- Chat tests: clear during streaming, late-callback guard, source metadata fallback, Markdown plus Demo coexistence, auto-follow opt-out, and completion live status.
- Browser E2E: real workspace source extraction, question/source/Markdown/Demo chain, desktop and mobile overflow, dropdown focus behavior, and touch-accessible type details.

`vue-component-meta` extraction E2E must use a source tree inside an existing TypeScript/Vue `tsconfig` program. Arbitrary OS temp directories cannot resolve the Vue type environment reliably. Prefer the repository root plus explicit `componentEntries`; use in-memory external knowledge fixtures for synthetic contract shapes.

### 7. Wrong vs Correct

#### Wrong

```ts
const history = turns.flatMap(toMessages).slice(-20)
await readStream()
turn.status = 'done' // EOF is not a protocol terminal event
```

#### Correct

```ts
const history = buildChatHistory(turns)
await streamQuery(question, 5, history, reduceEvent, signal)
// Only the `done` event reducer sets status to completed.
```

## UI regression rules

- Keep `ChatView` mounted while switching to the knowledge workspace; it owns in-memory turns and the active abort controller.
- Long contract tables scroll inside their section. The document and knowledge workspace must not gain horizontal overflow.
- Use explicit request states for checking/loading/empty/error. An empty array before a request completes is not an empty knowledge base.
- Command icons require accessible names and tooltips. View switches use tab semantics and keyboard navigation.
- Floating UI closes with Escape and click-outside. Restore the trigger only when focus fell back to the document root; never steal focus from another control selected by the user.
