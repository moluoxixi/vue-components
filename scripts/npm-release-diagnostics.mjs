import { spawnSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

// Never return input, filenames, error messages, URLs, tokens, or log lines.
export function classifyLog(text) {
  const checks = [
    ['missing_oidc_permissions', /oidc Skipped because incorrect permissions for id-token/],
    ['missing_id_token', /oidc Skipped because no id_token available/],
    ['github_id_token_request_failed', /oidc Failed to fetch id_token from GitHub/],
    ['npm_token_exchange_failed', /oidc Failed token exchange request/],
    ['npm_exchange_token_missing', /oidc Failed because token exchange was missing/],
    ['oidc_token_received', /oidc Successfully retrieved and set token/],
    ['oidc_internal_failure', /oidc Failure with message:/],
    ['authentication_required', /(?:code|error) ENEEDAUTH/],
  ]
  return checks.filter(([, pattern]) => pattern.test(text)).map(([label]) => label)
}

export function environmentSummary(env) {
  return {
    githubActions: env.GITHUB_ACTIONS === 'true',
    oidcRequestUrlPresent: Boolean(env.ACTIONS_ID_TOKEN_REQUEST_URL),
    oidcRequestTokenPresent: Boolean(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN),
    explicitIdTokenPresent: Boolean(env.NPM_ID_TOKEN),
    expectedRepository: env.GITHUB_REPOSITORY === 'moluoxixi/vue-components',
    expectedWorkflow: env.GITHUB_WORKFLOW_REF === 'moluoxixi/vue-components/.github/workflows/release.yml@refs/heads/main',
  }
}

function version(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 10000 })
  const value = result.stdout?.trim()
  return result.status === 0 && /^\d+\.\d+\.\d+$/.test(value) ? value : 'unavailable'
}

async function main() {
  if (process.argv.includes('--logs')) {
    const labels = new Set()
    try {
      // Dedicated cache is used only by this run's publish step.
      const directory = join(process.env.RUNNER_TEMP, 'npm-release-diagnostic-cache', '_logs')
      const files = await readdir(directory)
      for (const file of files.filter(name => /^\d{4}-\d{2}-\d{2}T[\d_]+Z-debug-\d+\.log$/.test(name))) {
        for (const label of classifyLog(await readFile(join(directory, file), 'utf8')))
          labels.add(label)
      }
    }
    catch {
      labels.add('diagnostic_logs_unavailable')
    }
    console.log(JSON.stringify({ npmReleaseDiagnostics: [...labels].sort(), classificationOnly: true }))
    return
  }
  console.log(JSON.stringify({ npmReleaseEnvironment: environmentSummary(process.env), npm: version('npm'), pnpm: version('pnpm') }))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main()
