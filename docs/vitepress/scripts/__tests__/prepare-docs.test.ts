// @vitest-environment node

import { unlinkSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docsGeneratedPrepareLockPath, ensureDocsGeneratedDirectories } from '../../.vitepress/site/generated-paths'
import { prepareDocs, PrepareDocsError } from '../prepare-docs.mts'
import { syncSelectedMetadata } from '../sync-selected-metadata.mts'

describe('documentation preparation pipeline', () => {
  it('reports ordered successful milestones with provider, path, and durations', () => {
    const logs: string[] = []
    const steps: string[] = []
    let time = 0

    prepareDocs({
      log: message => logs.push(message),
      now: () => {
        time += 25
        return time
      },
      providerId: 'gitlab',
      run: (command) => {
        steps.push(command.name)
        return { exitCode: 0 }
      },
    })

    expect(steps).toEqual([
      'workspace dependencies',
      'component routes',
      'utility routes',
      'API contracts',
      'selected provider sync',
      'selected snapshot validation',
    ])
    expect(logs).toContain('[docs:prepare] START workspace dependencies')
    expect(logs).toContain('[docs:prepare] OK workspace dependencies duration=25ms')
    expect(logs).toContain(
      '[docs:prepare] START selected provider sync provider=gitlab path=.generated/repository',
    )
    expect(logs.at(-1)).toBe(
      '[docs:prepare] OK preparation complete duration=0ms provider=gitlab',
    )
  })

  it('reports the failing step and exit code, then stops without exposing tokens', () => {
    const logs: string[] = []
    const steps: string[] = []
    const token = 'secret-provider-token'

    expect(() => prepareDocs({
      log: message => logs.push(message),
      now: () => 100,
      providerId: 'github',
      run: (command) => {
        steps.push(command.name)
        return command.name === 'API contracts'
          ? { exitCode: 7, error: new Error(token) }
          : { exitCode: 0 }
      },
    })).toThrow(PrepareDocsError)

    expect(steps).toEqual([
      'workspace dependencies',
      'component routes',
      'utility routes',
      'API contracts',
    ])
    expect(logs.at(-1)).toBe('[docs:prepare] FAIL API contracts duration=0ms exitCode=7')
    expect(logs.join('\n')).not.toContain(token)
  })

  it('dispatches exactly one selected provider sync script', () => {
    const scripts: string[] = []
    expect(syncSelectedMetadata('gitee', (scriptPath) => {
      scripts.push(scriptPath.replaceAll('\\', '/'))
      return 0
    })).toBe(0)
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toMatch(/\/sync-gitee-metadata\.mts$/)
    expect(() => syncSelectedMetadata('auto')).toThrow(
      'No repository metadata sync command for provider: auto',
    )
  })

  it('fails visibly when another preparation process owns the generated lock', () => {
    ensureDocsGeneratedDirectories()
    writeFileSync(docsGeneratedPrepareLockPath, 'held\n', 'utf8')
    try {
      const logs: string[] = []
      expect(() => prepareDocs({ log: message => logs.push(message) })).toThrow(PrepareDocsError)
      expect(logs).toContain('[docs:prepare] FAIL prepare lock duration=0ms exitCode=1')
    }
    finally {
      unlinkSync(docsGeneratedPrepareLockPath)
    }
  })
})
