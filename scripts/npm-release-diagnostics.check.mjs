import assert from 'node:assert/strict'
import { classifyLog, environmentSummary } from './npm-release-diagnostics.mjs'

const secret = 'CANARY_SECRET_NEVER_OUTPUT'
const input = [
  '17 verbose oidc Failed token exchange request with body message: ' + secret,
  '18 verbose oidc Successfully retrieved and set token',
  '19 error code ENEEDAUTH',
  'Authorization: Bearer ' + secret,
  'https://example.invalid/token?secret=' + secret,
  'unknown error ' + secret,
].join('\n')
assert.deepEqual(classifyLog(input), ['npm_token_exchange_failed', 'oidc_token_received', 'authentication_required'])
assert.deepEqual(classifyLog('unknown ' + secret), [])
const summary = environmentSummary({
  GITHUB_ACTIONS: 'true',
  ACTIONS_ID_TOKEN_REQUEST_URL: secret,
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: secret,
  NPM_ID_TOKEN: secret,
  GITHUB_REPOSITORY: 'moluoxixi/vue-components',
  GITHUB_WORKFLOW_REF: 'moluoxixi/vue-components/.github/workflows/release.yml@refs/heads/main',
})
assert.equal(Object.values(summary).every(value => value === true), true)
assert.equal(JSON.stringify({ labels: classifyLog(input), summary }).includes(secret), false)
assert.deepEqual(classifyLog('verbose oidc Failed to fetch id_token from GitHub: missing value'), ['github_id_token_request_failed'])
assert.deepEqual(classifyLog('silly oidc Skipped because incorrect permissions for id-token within GitHub workflow'), ['missing_oidc_permissions'])
assert.deepEqual(classifyLog('silly oidc Skipped because no id_token available'), ['missing_id_token'])
assert.deepEqual(classifyLog('verbose oidc Failed because token exchange was missing the token in the response body'), ['npm_exchange_token_missing'])
assert.deepEqual(classifyLog('verbose oidc Failure with message: ' + secret), ['oidc_internal_failure'])
assert.equal(Object.values(environmentSummary({})).every(value => value === false), true)
console.log('npm release diagnostic safety checks passed')
