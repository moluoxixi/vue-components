import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'

const COMPONENT_EXCEPTION_KINDS = new Set(['dynamic', 'framework', 'public'])
const IMPORT_EXCEPTION_KINDS = new Set(['cycle', 'lazy', 'platform'])
const PACKAGE_EXCEPTION_KINDS = new Set(['cli', 'framework', 'private-app'])
const PATH_EXCEPTION_KINDS = new Set(['generated', 'third-party'])
const PACKAGES_GOVERNANCE_TASK_ID = 'packages-architecture-governance'

function assertArray(value, name) {
  if (!Array.isArray(value))
    throw new Error(`Package architecture manifest ${name} must be an array.`)
}

function assertNonEmptyArray(value, name) {
  assertArray(value, name)
  if (value.length === 0)
    throw new Error(`Package architecture manifest ${name} must not be empty.`)
}

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`Package architecture manifest ${name} must be a non-empty string.`)
}

function assertEnum(value, values, name) {
  assertString(value, name)
  if (!values.has(value))
    throw new Error(`Package architecture manifest ${name} has unsupported value "${value}".`)
}

function assertUnique(values, name) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value))
      throw new Error(`Package architecture manifest ${name} contains duplicate entry ${value}.`)
    seen.add(value)
  }
}

function assertRepositoryPath(repositoryRoot, path, name, suffix = '') {
  if (repositoryRoot && !existsSync(resolve(repositoryRoot, path, suffix)))
    throw new Error(`Package architecture manifest ${name} points to missing path ${path}.`)
}

function collectTasks(directory, tasks = new Map()) {
  if (!existsSync(directory))
    return tasks
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      collectTasks(path, tasks)
      continue
    }
    if (entry.isFile() && entry.name === 'task.json') {
      const task = JSON.parse(readFileSync(path, 'utf8'))
      for (const key of [task.id, task.name, basename(dirname(path))]) {
        if (typeof key === 'string')
          tasks.set(key, task)
      }
    }
  }
  return tasks
}

function isTaskDescendantOf(taskId, ancestorId, tasks) {
  let task = tasks.get(taskId)
  const visited = new Set()
  while (task?.parent && !visited.has(task.parent)) {
    if (task.parent === ancestorId)
      return true
    visited.add(task.parent)
    const parent = tasks.get(task.parent)
    if (parent?.id === ancestorId || parent?.name === ancestorId)
      return true
    task = parent
  }
  return false
}

export function validatePackageArchitectureManifest(manifest, repositoryRoot) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new Error('Package architecture manifest must be an object.')
  if (manifest.version !== 1)
    throw new Error('Package architecture manifest version must be 1.')
  assertArray(manifest.packageExceptions, 'packageExceptions')
  assertArray(manifest.pathExceptions, 'pathExceptions')
  assertArray(manifest.componentExceptions, 'componentExceptions')
  assertArray(manifest.importExceptions, 'importExceptions')
  assertArray(manifest.debt, 'debt')
  const tasks = repositoryRoot
    ? collectTasks(resolve(repositoryRoot, '.trellis/tasks'))
    : undefined

  for (const [index, exception] of manifest.packageExceptions.entries()) {
    assertString(exception.package, `packageExceptions[${index}].package`)
    assertEnum(exception.kind, PACKAGE_EXCEPTION_KINDS, `packageExceptions[${index}].kind`)
    assertString(exception.reason, `packageExceptions[${index}].reason`)
    assertNonEmptyArray(exception.rules, `packageExceptions[${index}].rules`)
    exception.rules.forEach((rule, ruleIndex) => assertString(rule, `packageExceptions[${index}].rules[${ruleIndex}]`))
    assertUnique(exception.rules, `packageExceptions[${index}].rules`)
    if (exception.rules.some(rule => !rule.startsWith('package.')))
      throw new Error(`Package architecture manifest packageExceptions[${index}].rules must contain package.* rules.`)
    assertRepositoryPath(repositoryRoot, exception.package, `packageExceptions[${index}].package`, 'package.json')
  }
  for (const [index, exception] of manifest.componentExceptions.entries()) {
    assertString(exception.component, `componentExceptions[${index}].component`)
    assertEnum(exception.kind, COMPONENT_EXCEPTION_KINDS, `componentExceptions[${index}].kind`)
    assertString(exception.reason, `componentExceptions[${index}].reason`)
    assertNonEmptyArray(exception.rules, `componentExceptions[${index}].rules`)
    exception.rules.forEach((rule, ruleIndex) => assertString(rule, `componentExceptions[${index}].rules[${ruleIndex}]`))
    assertUnique(exception.rules, `componentExceptions[${index}].rules`)
    if (exception.rules.some(rule => !rule.startsWith('component.')))
      throw new Error(`Package architecture manifest componentExceptions[${index}].rules must contain component.* rules.`)
    assertNonEmptyArray(exception.owners, `componentExceptions[${index}].owners`)
    exception.owners.forEach((owner, ownerIndex) => assertString(owner, `componentExceptions[${index}].owners[${ownerIndex}]`))
    assertUnique(exception.owners, `componentExceptions[${index}].owners`)
    assertRepositoryPath(repositoryRoot, exception.component, `componentExceptions[${index}].component`)
    exception.owners.forEach((owner, ownerIndex) => (
      assertRepositoryPath(repositoryRoot, owner, `componentExceptions[${index}].owners[${ownerIndex}]`)
    ))
  }
  for (const [index, exception] of manifest.importExceptions.entries()) {
    assertString(exception.importer, `importExceptions[${index}].importer`)
    assertString(exception.target, `importExceptions[${index}].target`)
    assertString(exception.rule, `importExceptions[${index}].rule`)
    assertEnum(exception.kind, IMPORT_EXCEPTION_KINDS, `importExceptions[${index}].kind`)
    assertString(exception.reason, `importExceptions[${index}].reason`)
    if (!exception.rule.startsWith('feature.'))
      throw new Error(`Package architecture manifest importExceptions[${index}].rule must be a feature.* rule.`)
    assertRepositoryPath(repositoryRoot, exception.importer, `importExceptions[${index}].importer`)
    assertRepositoryPath(repositoryRoot, exception.target, `importExceptions[${index}].target`)
  }
  for (const [index, exception] of manifest.pathExceptions.entries()) {
    assertString(exception.path, `pathExceptions[${index}].path`)
    assertEnum(exception.kind, PATH_EXCEPTION_KINDS, `pathExceptions[${index}].kind`)
    assertString(exception.reason, `pathExceptions[${index}].reason`)
    assertRepositoryPath(repositoryRoot, exception.path, `pathExceptions[${index}].path`)
  }
  for (const [index, debt] of manifest.debt.entries()) {
    assertString(debt.path, `debt[${index}].path`)
    assertString(debt.rule, `debt[${index}].rule`)
    assertString(debt.targetTask, `debt[${index}].targetTask`)
    assertString(debt.reason, `debt[${index}].reason`)
    if (tasks && !tasks.has(debt.targetTask)) {
      throw new Error(
        `Package architecture manifest debt[${index}].targetTask points to missing task ${debt.targetTask}.`,
      )
    }
    if (tasks && !isTaskDescendantOf(debt.targetTask, PACKAGES_GOVERNANCE_TASK_ID, tasks)) {
      throw new Error(
        `Package architecture manifest debt[${index}].targetTask must belong to ${PACKAGES_GOVERNANCE_TASK_ID}.`,
      )
    }
    if (debt.owners !== undefined) {
      assertArray(debt.owners, `debt[${index}].owners`)
      debt.owners.forEach((owner, ownerIndex) => assertString(owner, `debt[${index}].owners[${ownerIndex}]`))
    }
  }

  assertUnique(manifest.pathExceptions.map(exception => exception.path), 'pathExceptions')
  assertUnique(manifest.packageExceptions.flatMap(exception => (
    exception.rules.map(rule => JSON.stringify([exception.package, rule]))
  )), 'packageExceptions rules')
  assertUnique(manifest.componentExceptions.flatMap(exception => (
    exception.rules.map(rule => JSON.stringify([
      exception.component,
      rule,
    ]))
  )), 'componentExceptions rules')
  assertUnique(manifest.importExceptions.map(exception => JSON.stringify([
    exception.rule,
    exception.importer,
    exception.target,
  ])), 'importExceptions')
  assertUnique(manifest.debt.map(debt => JSON.stringify([
    debt.rule,
    debt.path,
    [...(debt.owners ?? [])].sort(),
  ])), 'debt')
  return manifest
}

export function loadPackageArchitectureManifest(repositoryRoot, manifestPath) {
  const path = manifestPath ?? resolve(repositoryRoot, 'scripts/package-architecture/config/manifest.json')
  return validatePackageArchitectureManifest(JSON.parse(readFileSync(path, 'utf8')), repositoryRoot)
}
