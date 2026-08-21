# Bug Analysis: Codeup Markdown line anchors opened the preview

## 1. Root Cause Category

- **Category**: D/E - Test coverage gap and implicit platform assumption.
- **Specific cause**: The `/blob/...#Lx` route and anchor syntax were valid, but
  Codeup defaults non-README Markdown to a rendered preview without source line
  anchors. URL-string tests did not exercise that render-mode boundary.

## 2. Why the Earlier Fix Failed

1. The first fix reduced unreliable range anchors to `#L<start>`, but kept the
   Markdown preview as the landing view.
2. Unit and provider tests asserted the generated string, so they could not
   detect that Codeup ignored the anchor until its source view was selected.

## 3. Prevention Mechanisms

| Priority | Mechanism | Specific action | Status |
| --- | --- | --- | --- |
| P0 | Platform acceptance | Verify the generated URL in an authenticated Codeup browser, including active view and highlighted line. | Done |
| P0 | Integration test | Inject the Yunxiao selection into the real demo resolver and assert the final Markdown URL. | Done |
| P1 | Unit test | Distinguish Markdown URLs, which require `?README.md`, from ordinary source-file URLs. | Done |
| P1 | Documentation | Record the source-view marker in the provider contract and bilingual guide. | Done |

## 4. Systematic Expansion

- Source-management URL acceptance must validate both route syntax and landing
  render mode; a valid fragment is insufficient when the default view omits
  line anchors.
- Provider action factories remain the owner of platform-specific URL quirks.
  Demo rendering and playground providers must not duplicate Codeup logic.

## 5. Knowledge Capture

- Updated `.trellis/spec/docs/frontend/quality-guidelines.md`.
- Added theme URL coverage and docs demo-resolver integration coverage.
- Updated Chinese and English provider documentation.
